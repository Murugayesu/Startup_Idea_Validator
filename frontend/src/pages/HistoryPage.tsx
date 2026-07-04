import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuth'
import '../styles/HistoryPage.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
const PAGE_SIZE = 10

interface RunSummary {
  id: string
  startup_idea: string
  status: string
  validation_score: number | null
  created_at: string
  completed_at: string | null
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Queued', cls: 'status-pending' },
  running: { label: 'Analyzing…', cls: 'status-running' },
  complete: { label: 'Complete', cls: 'status-complete' },
  failed: { label: 'Failed', cls: 'status-failed' },
}

function scoreColor(score: number | null): string {
  if (!score) return ''
  if (score >= 8) return 'score-high'
  if (score >= 5) return 'score-mid'
  return 'score-low'
}

export default function HistoryPage() {
  const { session } = useAuthStore()
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    const fetchRuns = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `${API_BASE}/api/reports?page=${page}&page_size=${PAGE_SIZE}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        )
        if (!res.ok) throw new Error('Failed to load history')
        const data = await res.json()
        setRuns(data.runs)
        setTotal(data.total)
      } catch (e) {
        setError('Could not load your runs. Please try refreshing.')
      } finally {
        setIsLoading(false)
      }
    }
    fetchRuns()
  }, [session, page])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="history-page">
      <div className="history-header">
        <div>
          <h1>My Validations</h1>
          <p className="history-subtitle">{total} total run{total !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/validate" className="new-run-btn" id="new-run-btn">
          + New Validation
        </Link>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {isLoading ? (
        <div className="runs-skeleton">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🚀</div>
          <h2>No validations yet</h2>
          <p>Submit your first startup idea to get a decision-ready report.</p>
          <Link to="/validate" className="new-run-btn">Validate an idea →</Link>
        </div>
      ) : (
        <div className="runs-list">
          {runs.map((run) => {
            const statusInfo = STATUS_LABELS[run.status] ?? { label: run.status, cls: '' }
            return (
              <Link
                key={run.id}
                to={`/run/${run.id}`}
                className="run-card"
                id={`run-card-${run.id}`}
              >
                <div className="run-card-main">
                  <p className="run-idea-text">{run.startup_idea}</p>
                  <div className="run-card-meta">
                    <span className={`status-badge ${statusInfo.cls}`}>{statusInfo.label}</span>
                    <span className="run-date">
                      {new Date(run.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
                {run.validation_score && (
                  <div className={`run-score ${scoreColor(run.validation_score)}`}>
                    <span className="score-num">{run.validation_score}</span>
                    <span className="score-denom">/10</span>
                  </div>
                )}
                <span className="run-arrow">→</span>
              </Link>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            id="pagination-prev"
          >
            ← Prev
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            id="pagination-next"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
