import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuth'
import '../styles/ValidatePage.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
const MAX_CHARS = 2000
const MIN_CHARS = 20

export default function ValidatePage() {
  const [idea, setIdea] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { session } = useAuthStore()

  const charCount = idea.length
  const isValid = charCount >= MIN_CHARS && charCount <= MAX_CHARS

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || isSubmitting) return
    setError(null)
    setIsSubmitting(true)

    try {
      const res = await fetch(`${API_BASE}/api/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ startup_idea: idea }),
      })

      if (res.status === 429) {
        const data = await res.json()
        setError(data.detail || 'Daily limit reached. Try again tomorrow.')
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.detail || 'Something went wrong. Please try again.')
        return
      }

      const { run_id } = await res.json()
      navigate(`/run/${run_id}`)
    } catch (err) {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="validate-page">
      <div className="validate-hero">
        <div className="hero-badge">AI-Powered Analysis</div>
        <h1>Validate Your Startup Idea</h1>
        <p className="hero-subtitle">
          Get a decision-ready report — market sizing, technical feasibility, SWOT analysis,
          and an honest validation score — in under 3 minutes.
        </p>
      </div>

      <div className="validate-card">
        <form onSubmit={handleSubmit} className="idea-form">
          <div className="form-field">
            <label htmlFor="startup-idea">Describe your startup idea</label>
            <p className="field-hint">
              Be specific: what problem does it solve, who is the customer, and how does it make money?
            </p>
            <textarea
              id="startup-idea"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="E.g. A SaaS platform for independent physiotherapists to manage patient exercise programs remotely — patients receive personalized video exercise plans and therapists can track adherence and progress in real-time, replacing paper handouts and WhatsApp videos..."
              rows={8}
              maxLength={MAX_CHARS}
              disabled={isSubmitting}
            />
            <div className="char-counter">
              <span className={charCount < MIN_CHARS ? 'counter-warn' : ''}>
                {charCount < MIN_CHARS ? `${MIN_CHARS - charCount} more characters needed` : `${charCount} / ${MAX_CHARS}`}
              </span>
            </div>
          </div>

          {error && (
            <div className="error-banner" role="alert">
              <span className="error-icon">⚠</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="submit-btn"
            disabled={!isValid || isSubmitting}
            id="validate-submit-btn"
          >
            {isSubmitting ? (
              <>
                <span className="btn-spinner" />
                Queuing analysis…
              </>
            ) : (
              <>
                <span className="btn-icon">⚡</span>
                Validate My Idea
              </>
            )}
          </button>

          <p className="submit-note">3 free validations per day · Results saved automatically</p>
        </form>
      </div>

      <div className="features-grid">
        {[
          { icon: '📊', title: 'Market Sizing', desc: 'TAM/SAM/SOM with real web research and reproducible math' },
          { icon: '⚙️', title: 'Technical Feasibility', desc: 'Stack recommendations, timeline estimate, and build risks' },
          { icon: '♟️', title: 'SWOT Analysis', desc: 'Specific strengths, weaknesses, opportunities, and threats' },
          { icon: '🎯', title: 'Honest Score', desc: '1–10 validation score with frank justification — no LLM cheerleading' },
        ].map((f) => (
          <div className="feature-card" key={f.title}>
            <div className="feature-icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
