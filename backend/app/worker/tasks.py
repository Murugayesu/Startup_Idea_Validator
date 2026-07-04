"""
Celery Tasks
------------
run_validation_task  — main task that runs the CrewAI crew
cleanup_stuck_runs   — periodic task (Celery Beat) for Phase 3
"""

import logging
import re
from datetime import datetime, timezone, timedelta

from app.worker.celery_app import celery_app
from app.core.supabase import get_service_client
from app.core.config import get_settings
from app.agents.crew import build_crew, extract_score
from app.agents.callbacks import make_step_callback, write_agent_event

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="app.worker.tasks.run_validation_task",
    max_retries=0,          # No auto-retry — failures are recorded and surfaced to user
    time_limit=720,         # Hard 12-min OS-level kill (safety net above app-level timeout)
    soft_time_limit=660,    # Soft 11-min limit — allows graceful cleanup
)
def run_validation_task(self, run_id: str, startup_idea: str, user_id: str) -> dict:
    """
    Executes the 4-agent CrewAI validation pipeline for a submitted idea.
    Writes progress to run_events and final result to validation_runs.
    """
    db = get_service_client()
    settings = get_settings()

    def _update_run(status: str, **kwargs):
        update_data = {"status": status, **kwargs}
        db.table("validation_runs").update(update_data).eq("id", run_id).execute()

    def _write_event(agent_name, event_type, message):
        write_agent_event(run_id, db, agent_name, event_type, message)

    try:
        # --- Mark as running ---
        _update_run("running")
        _write_event(None, "started", f"Validation started for: {startup_idea[:200]}")
        logger.info(f"[run={run_id}] Starting validation for user={user_id}")

        # --- Build step callback bound to this run ---
        step_cb = make_step_callback(run_id, db)

        # --- Run the crew ---
        crew = build_crew(startup_idea=startup_idea, step_callback=step_cb)
        result = crew.kickoff()

        # --- Extract report and score ---
        report_markdown = str(result) if result else ""
        validation_score = extract_score(report_markdown)

        if not report_markdown:
            raise ValueError("CrewAI returned an empty report")

        # --- Persist completed run ---
        _update_run(
            "complete",
            report_markdown=report_markdown,
            validation_score=validation_score,
            completed_at=datetime.now(timezone.utc).isoformat(),
        )
        _write_event("Report Compiler", "completed", f"Report complete. Score: {validation_score}/10")
        logger.info(f"[run={run_id}] Completed. Score={validation_score}")

        return {"run_id": run_id, "status": "complete", "score": validation_score}

    except Exception as exc:
        error_msg = str(exc)[:1000]
        logger.error(f"[run={run_id}] FAILED: {error_msg}", exc_info=True)
        try:
            _update_run("failed", error_message=error_msg, completed_at=datetime.now(timezone.utc).isoformat())
            _write_event(None, "error", f"Run failed: {error_msg}")
        except Exception as db_exc:
            logger.error(f"[run={run_id}] Could not write failure to DB: {db_exc}")
        raise


@celery_app.task(name="app.worker.tasks.cleanup_stuck_runs")
def cleanup_stuck_runs() -> dict:
    """
    Periodic Celery Beat task.
    Marks runs stuck in 'pending' or 'running' beyond MAX_RUN_DURATION_MINUTES as 'failed'.
    Prevents infinite spinners in the frontend.
    """
    db = get_service_client()
    settings = get_settings()
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.max_run_duration_minutes)
    cutoff_iso = cutoff.isoformat()

    try:
        # Fetch stuck runs
        result = (
            db.table("validation_runs")
            .select("id")
            .in_("status", ["pending", "running"])
            .lt("created_at", cutoff_iso)
            .execute()
        )
        stuck = result.data or []

        for run in stuck:
            run_id = run["id"]
            db.table("validation_runs").update({
                "status": "failed",
                "error_message": f"Run timed out after {settings.max_run_duration_minutes} minutes.",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", run_id).execute()

            write_agent_event(
                run_id, db, None, "error",
                f"Run automatically marked failed after {settings.max_run_duration_minutes} minute timeout."
            )
            logger.warning(f"[cleanup] Marked stuck run={run_id} as failed")

        return {"cleaned_up": len(stuck)}

    except Exception as e:
        logger.error(f"[cleanup] Error during stuck-run cleanup: {e}", exc_info=True)
        return {"error": str(e)}
