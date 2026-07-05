import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useRunEvents } from '../hooks/useRunEvents'
import { useAuthStore } from '../hooks/useAuth'
import AgentProgressFeed from '../components/AgentProgressFeed'
import ReportViewer from '../components/ReportViewer'
import '../styles/RunPage.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

interface RunData {
  id: string
  startup_idea: string
  status: string
  validation_score: number | null
  report_markdown: string | null
  error_message: string | null
  created_at: string
}

// ── Error helpers ────────────────────────────────────────────────────────────
function extractFriendlyError(raw: string | null): { title: string; detail: string | null } {
  if (!raw) return { title: 'An unexpected error occurred.', detail: null }

  // Try to pull the innermost Groq/litellm "message" value from JSON
  const jsonMsgMatch = raw.match(/"message"\s*:\s*"([^"]+)"/) 
  if (jsonMsgMatch) {
    const msg = jsonMsgMatch[1]
    // Strip out the "failed_generation" spill if present
    const clean = msg.replace(/\\n.*$/, '').trim()
    return { title: clean, detail: raw }
  }

  // Strip Python exception class prefix e.g. "litellm.BadRequestError: GroqException - ..."
  const exMatch = raw.match(/(?:[\w.]+Error|Exception)[:\s-]+(.+)/s)
  if (exMatch) {
    // Take just first sentence / first 120 chars
    const first = exMatch[1].replace(/[\n\r].*/s, '').trim().slice(0, 180)
    return { title: first, detail: raw }
  }

  // Fallback: first 180 chars
  return { title: raw.slice(0, 180) + (raw.length > 180 ? '…' : ''), detail: raw.length > 180 ? raw : null }
}

function ErrorBanner({ errorMessage }: { errorMessage: string | null }) {
  const [showDetail, setShowDetail] = useState(false)
  const { title, detail } = extractFriendlyError(errorMessage)

  return (
    <div className="failure-banner" role="alert">
      <div className="failure-icon">✕</div>
      <div className="failure-body">
        <h3>Validation failed</h3>
        <p className="failure-reason">{title}</p>
        {detail && (
          <button
            className="failure-details-toggle"
            onClick={() => setShowDetail(v => !v)}
            aria-expanded={showDetail}
          >
            {showDetail ? '▲ Hide details' : '▼ Show technical details'}
          </button>
        )}
        {showDetail && detail && (
          <pre className="failure-detail-block">{detail}</pre>
        )}
        <Link to="/validate" className="retry-btn">Try a new idea →</Link>
      </div>
    </div>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

export default function RunPage() {
  const { runId } = useParams<{ runId: string }>()
  const navigate = useNavigate()
  const { session } = useAuthStore()
  const { events, status, isLoading } = useRunEvents(runId ?? null)
  const [runData, setRunData] = useState<RunData | null>(null)
  const [activeTab, setActiveTab] = useState<'progress' | 'report'>('progress')

  useEffect(() => {
    if (!runId || !session) return
    const fetchRun = async () => {
      const res = await fetch(`${API_BASE}/api/reports/${runId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setRunData(data)
      } else if (res.status === 404) {
        navigate('/history')
      }
    }
    fetchRun()
  }, [runId, session, navigate])

  // Refetch run data when status becomes complete/failed to get the report
  useEffect(() => {
    if ((status === 'complete' || status === 'failed') && session && runId) {
      fetch(`${API_BASE}/api/reports/${runId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          setRunData(data)
          if (status === 'complete') setActiveTab('report')
        })
        .catch(console.error)
    }
  }, [status, runId, session])

  const isComplete = status === 'complete'
  const isFailed = status === 'failed'
  const isRunning = status === 'running' || status === 'pending'

  const statusLabel: Record<string, string> = {
    pending: 'Queued',
    running: 'Analyzing…',
    complete: 'Complete',
    failed: 'Failed',
  }

  return (
    <div className="run-page">
      <div className="run-header">
        <Link to="/history" className="back-link">← My Runs</Link>
        <div className="run-meta">
          <span className={`status-badge status-${status ?? 'pending'}`}>
            {statusLabel[status ?? 'pending'] ?? status}
          </span>
          {isComplete && runData?.validation_score && (
            <span className="score-badge">Score: {runData.validation_score}/10</span>
          )}
        </div>
      </div>

      {runData && (
        <div className="idea-banner">
          <p className="idea-label">Validating</p>
          <p className="idea-text">"{runData.startup_idea}"</p>
        </div>
      )}

      {isRunning && (
        <div className="run-progress-bar">
          <div className="progress-bar-fill" />
          <p className="progress-label">
            Our AI research crew is working on your idea — this takes 1–3 minutes
          </p>
        </div>
      )}

      {isFailed && (
        <ErrorBanner errorMessage={runData?.error_message ?? null} />
      )}

      <div className="tab-bar">
        <button
          className={`tab-btn ${activeTab === 'progress' ? 'active' : ''}`}
          onClick={() => setActiveTab('progress')}
          id="tab-progress"
        >
          Agent Activity
          {events.length > 0 && <span className="tab-badge">{events.length}</span>}
        </button>
        {isComplete && (
          <button
            className={`tab-btn ${activeTab === 'report' ? 'active' : ''}`}
            onClick={() => setActiveTab('report')}
            id="tab-report"
          >
            Full Report
          </button>
        )}
      </div>

      <div className="tab-content">
        {activeTab === 'progress' && (
          <AgentProgressFeed events={events} isRunning={isRunning} isLoading={isLoading} status={status} />
        )}
        {activeTab === 'report' && isComplete && runData?.report_markdown && (
          <ReportViewer
            markdown={runData.report_markdown}
            score={runData.validation_score}
          />
        )}
      </div>
    </div>
  )
}
