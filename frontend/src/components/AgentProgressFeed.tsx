import { useState, useEffect, useRef } from 'react'
import type { RunEvent, RunStatus } from '../hooks/useRunEvents'
import '../styles/AgentProgressFeed.css'

// ── Pipeline definition ─────────────────────────────────────────────────────
// Order here determines the left-to-right sequence in the stepper.
const PIPELINE = [
  { id: 'market',   role: 'Market Research Analyst',       label: 'Market Research', short: 'MR' },
  { id: 'tech',     role: 'Technical Feasibility Analyst', label: 'Tech Analysis',   short: 'TA' },
  { id: 'strategy', role: 'Business Strategy Analyst',     label: 'Strategy',        short: 'BS' },
  { id: 'report',   role: 'Validation Report Compiler',    label: 'Report',          short: 'RC' },
]

const ROLE_TO_ID: Record<string, string> = {
  'Market Research Analyst':       'market',
  'Technical Feasibility Analyst': 'tech',
  'Business Strategy Analyst':     'strategy',
  'Validation Report Compiler':    'report',
  'Report Compiler':               'report',  // short form used in tasks.py
}

const EVENT_CONFIG: Record<string, { label: string; icon: string }> = {
  started:   { label: 'Started',   icon: '▶' },
  step:      { label: 'Output',    icon: '💬' },
  tool_call: { label: 'Tool Used', icon: '⚙' },
  completed: { label: 'Done',      icon: '✓' },
  error:     { label: 'Error',     icon: '✕' },
}

type AgentState = 'pending' | 'active' | 'done'

// ── Pipeline state derivation ───────────────────────────────────────────────
function getPipelineStates(
  events: RunEvent[],
  isRunning: boolean,
  status: RunStatus | null,
): AgentState[] {
  const ids = PIPELINE.map(p => p.id)
  let maxSeenIdx = -1

  events.forEach(e => {
    if (e.agent_name) {
      const id = ROLE_TO_ID[e.agent_name]
      if (id) {
        const idx = ids.indexOf(id)
        if (idx > maxSeenIdx) maxSeenIdx = idx
      }
    }
  })

  return ids.map((_, idx): AgentState => {
    if (status === 'complete') return 'done'
    if (idx < maxSeenIdx)     return 'done'
    if (idx === maxSeenIdx)   return isRunning ? 'active' : 'done'
    return 'pending'
  })
}

// ── Pipeline stepper ────────────────────────────────────────────────────────
function AgentStepper({
  events, isRunning, status,
}: { events: RunEvent[]; isRunning: boolean; status: RunStatus | null }) {
  const states = getPipelineStates(events, isRunning, status)

  return (
    <div className="pipeline-stepper" role="list" aria-label="Agent pipeline">
      {PIPELINE.map((agent, idx) => {
        const state = states[idx]
        return (
          <div key={agent.id} className="stepper-item" role="listitem">
            <div className={`stepper-step step-${state} step-clr-${agent.id}`}>
              <div className="step-icon">
                {state === 'done' ? (
                  <span className="step-check">✓</span>
                ) : state === 'active' ? (
                  <span className="step-bounce"><span /><span /><span /></span>
                ) : (
                  <span className="step-num">{idx + 1}</span>
                )}
              </div>
              <div className="step-text">
                <span className="step-short">{agent.short}</span>
                <span className="step-full">{agent.label}</span>
              </div>
            </div>
            {idx < PIPELINE.length - 1 && (
              <div className={`stepper-bar ${state === 'done' ? 'bar-done' : ''}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Tool call block ─────────────────────────────────────────────────────────
function ToolCallBlock({ raw }: { raw: string }) {
  let tool = 'tool'
  let input = raw

  try {
    const parsed = JSON.parse(raw)
    tool  = parsed.tool  || tool
    input = parsed.input || ''
  } catch {
    // fallback — show raw
  }

  return (
    <div className="tool-block">
      <div className="tool-block-header">
        <span className="tool-block-icon">⚙</span>
        <span className="tool-block-name">{tool}</span>
      </div>
      {input && (
        <pre className="tool-block-input">
          {input.length > 420 ? input.slice(0, 420) + '…' : input}
        </pre>
      )}
    </div>
  )
}

// ── Single event card ───────────────────────────────────────────────────────
const TRUNCATE = 300

function EventCard({ event }: { event: RunEvent }) {
  const [expanded, setExpanded] = useState(false)
  const isToolCall = event.event_type === 'tool_call'
  const agentId    = event.agent_name ? (ROLE_TO_ID[event.agent_name] ?? 'system') : 'system'
  const cfg        = EVENT_CONFIG[event.event_type] ?? { label: event.event_type, icon: '•' }
  const msg        = event.message ?? ''
  const isLong     = msg.length > TRUNCATE

  return (
    <div
      className={`event-card etype-${event.event_type} aclr-${agentId}`}
      id={`feed-item-${event.id}`}
    >
      <div className={`event-bar bar-${agentId}`} />
      <div className="event-body">
        {/* Header row */}
        <div className="event-header">
          <span className={`agent-pill pill-${agentId}`}>
            <span className="pill-dot" />
            {event.agent_name ?? 'System'}
          </span>
          <span className={`type-badge badge-${event.event_type}`}>
            {cfg.icon}&nbsp;{cfg.label}
          </span>
          <time className="event-ts">
            {new Date(event.created_at).toLocaleTimeString('en-US', {
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            })}
          </time>
        </div>

        {/* Content */}
        {isToolCall ? (
          <ToolCallBlock raw={msg} />
        ) : (
          <div className="event-msg-wrap">
            <p className="event-msg">
              {isLong && !expanded ? msg.slice(0, TRUNCATE) + '…' : msg}
            </p>
            {isLong && (
              <button
                className="expand-btn"
                onClick={() => setExpanded(v => !v)}
                aria-expanded={expanded}
              >
                {expanded ? '↑ Show less' : '↓ Show more'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Pulsing "agent working" placeholder ────────────────────────────────────
function ActivePulseCard() {
  return (
    <div className="event-card etype-pulse">
      <div className="event-bar bar-active" />
      <div className="event-body">
        <div className="event-header">
          <span className="agent-pill pill-active">
            <span className="pulse-dots"><span /><span /><span /></span>
            Agent working…
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Root component ──────────────────────────────────────────────────────────
interface Props {
  events: RunEvent[]
  isRunning: boolean
  isLoading: boolean
  status: RunStatus | null
}

export default function AgentProgressFeed({ events, isRunning, isLoading, status }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to newest event
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events.length])

  if (isLoading) {
    return (
      <div className="feed-state">
        <div className="feed-spinner" />
        <p>Connecting to live feed…</p>
      </div>
    )
  }

  if (events.length === 0 && !isRunning) {
    return (
      <div className="feed-state">
        <p className="feed-empty">No activity recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="feed-root">
      <AgentStepper events={events} isRunning={isRunning} status={status} />

      <div className="feed-list" aria-live="polite" aria-label="Agent activity feed">
        {events.map(event => (
          <EventCard key={event.id} event={event} />
        ))}
        {isRunning && <ActivePulseCard />}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

