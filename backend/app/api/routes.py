"""
API Routes
----------
POST /api/validate    — submit idea, enqueue job, return run_id
GET  /api/reports     — paginated list of caller's own runs
GET  /api/reports/{run_id} — single run detail + report
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user_id
from app.core.supabase import get_service_client
from app.core.config import get_settings
from app.worker.tasks import run_validation_task

router = APIRouter(prefix="/api")


# ---------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------

class ValidateRequest(BaseModel):
    startup_idea: str = Field(
        min_length=20,
        max_length=2000,
        description="Plain-language description of the startup idea to validate",
    )


class ValidateResponse(BaseModel):
    run_id: str


class RunSummary(BaseModel):
    id: str
    startup_idea: str
    status: str
    validation_score: int | None
    created_at: str
    completed_at: str | None


class RunDetail(RunSummary):
    report_markdown: str | None
    error_message: str | None


class ReportsResponse(BaseModel):
    runs: list[RunSummary]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------
# POST /api/validate
# ---------------------------------------------------------------

@router.post("/validate", response_model=ValidateResponse, status_code=status.HTTP_202_ACCEPTED)
async def submit_validation(
    body: ValidateRequest,
    user_id: str = Depends(get_current_user_id),
):
    settings = get_settings()
    db = get_service_client()

    # --- Rate limit check (all submissions count, including failed) ---
    count_result = db.rpc("get_daily_run_count", {"p_user_id": user_id}).execute()
    daily_count = count_result.data if isinstance(count_result.data, int) else 0

    if daily_count >= settings.daily_run_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily limit reached: {settings.daily_run_limit} validation runs per day. Try again tomorrow.",
        )

    # --- Create pending run row ---
    run_id = str(uuid.uuid4())
    db.table("validation_runs").insert({
        "id": run_id,
        "user_id": user_id,
        "startup_idea": body.startup_idea,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    # --- Enqueue Celery task (non-blocking) ---
    run_validation_task.apply_async(
        args=[run_id, body.startup_idea, user_id],
        task_id=run_id,   # Use run_id as Celery task_id for easy lookup
    )

    return ValidateResponse(run_id=run_id)


# ---------------------------------------------------------------
# GET /api/reports
# ---------------------------------------------------------------

@router.get("/reports", response_model=ReportsResponse)
async def list_reports(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    user_id: str = Depends(get_current_user_id),
):
    db = get_service_client()
    offset = (page - 1) * page_size

    # Count total for pagination
    count_result = (
        db.table("validation_runs")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )
    total = count_result.count or 0

    # Fetch page
    result = (
        db.table("validation_runs")
        .select("id, startup_idea, status, validation_score, created_at, completed_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )

    runs = [RunSummary(**row) for row in (result.data or [])]
    return ReportsResponse(runs=runs, total=total, page=page, page_size=page_size)


# ---------------------------------------------------------------
# GET /api/reports/{run_id}
# ---------------------------------------------------------------

@router.get("/reports/{run_id}", response_model=RunDetail)
async def get_report(
    run_id: str,
    user_id: str = Depends(get_current_user_id),
):
    db = get_service_client()

    result = (
        db.table("validation_runs")
        .select("id, startup_idea, status, validation_score, created_at, completed_at, report_markdown, error_message")
        .eq("id", run_id)
        .eq("user_id", user_id)   # Enforce ownership at application layer too (belt + suspenders with RLS)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found or you don't have permission to view it.",
        )

    return RunDetail(**result.data)
