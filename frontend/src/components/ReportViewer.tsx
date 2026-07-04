import ReactMarkdown from 'react-markdown'
import '../styles/ReportViewer.css'

interface Props {
  markdown: string
  score: number | null
}

function ScoreGauge({ score }: { score: number }) {
  const pct = (score / 10) * 100
  const cls = score >= 8 ? 'gauge-high' : score >= 5 ? 'gauge-mid' : 'gauge-low'
  return (
    <div className={`score-gauge ${cls}`}>
      <div className="gauge-ring">
        <svg viewBox="0 0 100 100">
          <circle className="gauge-track" cx="50" cy="50" r="40" />
          <circle
            className="gauge-fill"
            cx="50"
            cy="50"
            r="40"
            strokeDasharray={`${2 * Math.PI * 40}`}
            strokeDashoffset={`${2 * Math.PI * 40 * (1 - pct / 100)}`}
          />
        </svg>
        <div className="gauge-label">
          <span className="gauge-score">{score}</span>
          <span className="gauge-max">/10</span>
        </div>
      </div>
      <p className="gauge-verdict">
        {score >= 8 ? 'Strong Opportunity' : score >= 6 ? 'Worth Exploring' : score >= 4 ? 'Needs Work' : 'Not Recommended'}
      </p>
    </div>
  )
}

export default function ReportViewer({ markdown, score }: Props) {
  const handleCopy = () => {
    navigator.clipboard.writeText(markdown)
  }

  return (
    <div className="report-viewer" id="report-viewer">
      <div className="report-toolbar">
        {score && <ScoreGauge score={score} />}
        <button className="copy-btn" onClick={handleCopy} id="copy-report-btn">
          📋 Copy Report
        </button>
      </div>

      <div className="report-content">
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </div>
    </div>
  )
}
