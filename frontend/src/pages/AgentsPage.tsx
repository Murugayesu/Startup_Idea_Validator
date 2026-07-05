import '../styles/InfoPages.css'

export default function AgentsPage() {
  return (
    <div className="info-container">
      <div className="info-header">
        <h1>AI Agents Architecture</h1>
        <p>Startup Idea Validator is powered by a multi-agent system. Four specialized agents work in a sequential pipeline to evaluate your idea.</p>
      </div>

      <div className="agent-list">
        <div className="agent-card">
          <div className="agent-icon" style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>1</div>
          <div className="agent-details">
            <h2>Market Research Analyst</h2>
            <p className="agent-role">Sizing the market with real data.</p>
            <p>This agent searches the web for current industry data and uses a deterministic <strong>Market Calculator</strong> tool to compute precise TAM (Total Addressable Market), SAM (Serviceable Available Market), and SOM (Serviceable Obtainable Market). Math is strictly calculated, not LLM-estimated.</p>
          </div>
        </div>

        <div className="agent-card">
          <div className="agent-icon" style={{ background: 'rgba(20,184,166,0.15)', color: '#14b8a6' }}>2</div>
          <div className="agent-details">
            <h2>Technical Feasibility Analyst</h2>
            <p className="agent-role">Assessing build feasibility.</p>
            <p>Analyzes the technical requirements of your startup idea. It researches existing solutions, recommends a modern technology stack, and identifies the biggest architectural or engineering risks.</p>
          </div>
        </div>

        <div className="agent-card">
          <div className="agent-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>3</div>
          <div className="agent-details">
            <h2>Business Strategy Analyst</h2>
            <p className="agent-role">Structuring strategic risks.</p>
            <p>Taking the output from the Market Researcher, this agent uses the <strong>SWOT Analyzer</strong> tool to force a deep analysis of Strengths, Weaknesses, Opportunities, and Threats, ensuring no quadrant is overlooked.</p>
          </div>
        </div>

        <div className="agent-card">
          <div className="agent-icon" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>4</div>
          <div className="agent-details">
            <h2>Validation Report Compiler</h2>
            <p className="agent-role">Final synthesis & scoring.</p>
            <p>Synthesizes the findings of the three preceding agents into a cohesive, structured report. Most importantly, it assigns a highly critical 1-10 validation score based on the evidence, ignoring generic LLM sycophancy.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
