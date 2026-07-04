"""
CrewAI Step Callback
--------------------
Called after every agent step. Writes a run_events row to Supabase
using the service_role client (bypasses RLS — this is trusted infra).
"""

import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def make_step_callback(run_id: str, supabase_client):
    """
    Returns a CrewAI-compatible step callback bound to a specific run_id.

    The callback signature matches what CrewAI passes: (agent_output,)
    """

    def step_callback(agent_output) -> None:
        try:
            # agent_output can be an AgentFinish, AgentAction, or string
            # depending on CrewAI version — handle defensively
            if hasattr(agent_output, "log"):
                message = str(agent_output.log)[:2000]
                event_type = "completed"
            elif hasattr(agent_output, "tool"):
                tool_name = getattr(agent_output, "tool", "unknown_tool")
                tool_input = str(getattr(agent_output, "tool_input", ""))[:500]
                message = f"Calling tool: {tool_name} | Input: {tool_input}"
                event_type = "tool_call"
            else:
                message = str(agent_output)[:2000]
                event_type = "step"

            # Extract agent name if available
            agent_name = None
            if hasattr(agent_output, "agent") and hasattr(agent_output.agent, "role"):
                agent_name = agent_output.agent.role

            supabase_client.table("run_events").insert({
                "run_id": run_id,
                "agent_name": agent_name,
                "event_type": event_type,
                "message": message,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()

        except Exception as e:
            # Callback failures must not crash the agent run
            logger.error(f"[run={run_id}] step_callback error: {e}", exc_info=True)

    return step_callback


def write_agent_event(
    run_id: str,
    supabase_client,
    agent_name: str | None,
    event_type: str,
    message: str,
) -> None:
    """
    Helper for writing explicit events (started, completed, error)
    from the Celery task orchestration layer.
    """
    try:
        supabase_client.table("run_events").insert({
            "run_id": run_id,
            "agent_name": agent_name,
            "event_type": event_type,
            "message": message[:2000],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        logger.error(f"[run={run_id}] write_agent_event error: {e}", exc_info=True)
