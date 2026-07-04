import type { RunEvent } from '../hooks/useRunEvents'
import '../styles/AgentProgressFeed.css'

interface Props {
  events: RunEvent[]
  isRunning: boolean
  isLoading: boolean
}

const AGENT_COLORS: Record<string, string> = {
  'Market Research Analyst': 'agent-market',
  'Technical Feasibility Analyst': 'agent-tech',
  'Business Strategy Analyst': 'agent-strategy',
  'Validation Report Compiler': 'agent-report',
}

const EVENT_ICONS: Record<string, string> = {
  started: '▶',
  tool_call: '🔧',
  completed: '✓',
  error: '✕',
  step: '→',
}

function AgentAvatar({ name }: { name: string | null }) {
  if (!name) return <div className="agent-avatar agent-system">SYS</div>
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
  const cls = AGENT_COLORS[name] ?? 'agent-default'
  return <div className={`agent-avatar ${cls}`}>{initials}</div>
}

export default function AgentProgressFeed({ events, isRunning, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="feed-loading">
        <div className="feed-spinner" />
        <p>Connecting to live feed…</p>
      </div>
    )
  }

  if (events.length === 0 && !isRunning) {
    return (
      <div className="feed-empty">
        <p>No activity recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="agent-feed" id="agent-progress-feed" aria-live="polite">
      {events.map((event) => (
        <div
          key={event.id}
          className={`feed-item event-${event.event_type}`}
          id={`feed-item-${event.id}`}
        >
          <AgentAvatar name={event.agent_name} />
          <div className="feed-item-body">
            <div className="feed-item-header">
              <span className="feed-agent-name">{event.agent_name ?? 'System'}</span>
              <span className={`feed-event-type type-${event.event_type}`}>
                {EVENT_ICONS[event.event_type] ?? '•'} {event.event_type.replace('_', ' ')}
              </span>
              <span className="feed-timestamp">
                {new Date(event.created_at).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
            {event.message && (
              <p className="feed-message">{event.message}</p>
            )}
          </div>
        </div>
      ))}

      {isRunning && (
        <div className="feed-item feed-pulse">
          <div className="agent-avatar agent-thinking">
            <span className="thinking-dots">
              <span /><span /><span />
            </span>
          </div>
          <div className="feed-item-body">
            <p className="feed-message">Agent working…</p>
          </div>
        </div>
      )}
    </div>
  )
}
