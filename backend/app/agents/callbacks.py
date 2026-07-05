"""
CrewAI Step Callback
--------------------
Called after every agent task step. Writes a run_events row to Supabase
using the service_role client (bypasses RLS — trusted infra only).

CrewAI version compatibility:
  >= 0.80  step_callback receives TaskOutput  (.raw: str, .agent: str)
  legacy   step_callback receives AgentFinish (.return_values["output"] | .log)
           or AgentAction                     (.tool, .tool_input)
"""

import re
import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

def _extract_agent_name(agent_output) -> str | None:
    """Extract agent role string from any CrewAI output type."""
    agent = getattr(agent_output, "agent", None)
    if isinstance(agent, str) and agent:
        return agent
    if agent is not None and hasattr(agent, "role"):
        return str(agent.role)
    return None


def _parse_output(agent_output) -> tuple[str | None, str]:
    """
    Return (message, event_type) from a CrewAI step callback payload.

    Handles:
      1. TaskOutput      — CrewAI >= 0.80          -> event_type "completed"
      2. AgentFinish     — return_values["output"]  -> event_type "completed"
      3. AgentFinish     — .log attribute            -> event_type "completed"
      4. AgentAction     — tool call                 -> event_type "tool_call"
      5. list of tuples  — intermediate steps        -> event_type "tool_call"
      6. str             — plain string              -> event_type "step"
      7. fallback        — strip Python repr wrapper -> event_type "step"
    """

    # 1. TaskOutput (CrewAI >= 0.80) ─────────────────────────────────────────
    if hasattr(agent_output, "raw"):
        raw = (getattr(agent_output, "raw", "") or "").strip()
        return (raw[:20000] if raw else None), "completed"

    # 2. AgentFinish via return_values dict ──────────────────────────────────
    if hasattr(agent_output, "return_values"):
        output = (agent_output.return_values.get("output") or "").strip()
        return (output[:20000] if output else None), "completed"

    # 3. AgentFinish via log attribute ───────────────────────────────────────
    log_attr = getattr(agent_output, "log", None)
    if log_attr:
        text = str(log_attr).strip()
        return (text[:20000] if text else None), "completed"

    # 4. AgentAction (single tool call) ──────────────────────────────────────
    if hasattr(agent_output, "tool"):
        tool_name = str(getattr(agent_output, "tool", "unknown"))
        tool_input = str(getattr(agent_output, "tool_input", ""))
        payload = json.dumps({"tool": tool_name, "input": tool_input[:500]})
        return payload, "tool_call"

    # 5. List of (AgentAction, observation) tuples ───────────────────────────
    if isinstance(agent_output, list) and agent_output:
        first = agent_output[0]
        if isinstance(first, tuple) and len(first) == 2:
            action, observation = first
            tool_name = str(getattr(action, "tool", "unknown"))
            payload = json.dumps({"tool": tool_name, "input": str(observation)[:500]})
            return payload, "tool_call"
        return str(first)[:20000], "step"

    # 6. Plain string ─────────────────────────────────────────────────────────
    if isinstance(agent_output, str):
        stripped = agent_output.strip()
        return (stripped[:20000] if stripped else None), "step"

    # 7. Fallback — strip "AgentFinish(thought='...', output='...')" repr wrappers
    raw = str(agent_output)
    match = re.search(
        r"output=['\"]+(.*?)['\"]+(?:,\s*text=|,\s*return_values|$|\))",
        raw,
        re.DOTALL,
    )
    if match:
        cleaned = match.group(1).strip()
        return (cleaned[:20000] if cleaned else None), "step"

    stripped = raw.strip()
    return (stripped[:20000] if stripped else None), "step"


# ---------------------------------------------------------------------------
# Public callback factory
# ---------------------------------------------------------------------------

def make_step_callback(run_id: str, supabase_client, agent_name: str | None = None):
    """
    Returns a CrewAI-compatible step callback bound to a specific run_id.
    Callback failures are swallowed — they must never crash an agent run.
    """

    def step_callback(agent_output) -> None:
        try:
            message, event_type = _parse_output(agent_output)
            if not message:
                return  # Skip empty / noise events
                
            # Unescape newlines to fix markdown rendering in the UI
            message = message.replace("\\n", "\n").replace("\\t", "\t")

            # Use explicitly passed agent_name if available, else try to extract
            final_agent_name = agent_name or _extract_agent_name(agent_output)

            supabase_client.table("run_events").insert({
                "run_id": run_id,
                "agent_name": final_agent_name,
                "event_type": event_type,
                "message": message,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()

        except Exception as e:
            logger.error(f"[run={run_id}] step_callback error: {e}", exc_info=True)

    return step_callback


# ---------------------------------------------------------------------------
# Utility: write an explicit event from orchestration code
# ---------------------------------------------------------------------------

def write_agent_event(
    run_id: str,
    supabase_client,
    agent_name: str | None,
    event_type: str,
    message: str,
) -> None:
    """
    Write explicit events (started, completed, error) from the Celery task layer.
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
