import { useNavigate } from 'react-router-dom'
import '../styles/LandingPage.css'
import { useAuthStore } from '../hooks/useAuth'

export default function LandingPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  return (
    <div className="landing-container">
      <div className="landing-hero">
        <h1 className="landing-title">
          Validate your startup idea with <span className="highlight">AI Agents</span>
        </h1>
        <p className="landing-subtitle">
          Get a decision-ready report with market sizing, technical feasibility, SWOT analysis, and an honest score in minutes.
        </p>
        
        <div className="landing-actions">
          <button 
            className="btn-primary btn-large" 
            onClick={() => navigate('/validate')}
          >
            {user ? 'Start Validating' : 'Sign In to Validate'}
          </button>
          <button 
            className="btn-secondary btn-large" 
            onClick={() => navigate('/agents')}
          >
            How it works
          </button>
        </div>
      </div>
      
      <div className="landing-features">
        <div className="feature-card">
          <div className="feature-icon">📊</div>
          <h3>Market Research</h3>
          <p>Calculates precise TAM, SAM, and SOM based on real web data.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">⚙️</div>
          <h3>Technical Feasibility</h3>
          <p>Recommends the best tech stack and highlights architectural risks.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">♟️</div>
          <h3>Business Strategy</h3>
          <p>Performs a deep SWOT analysis informed by market research.</p>
        </div>
      </div>
    </div>
  )
}
