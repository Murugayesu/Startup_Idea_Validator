import '../styles/InfoPages.css'

export default function AboutPage() {
  return (
    <div className="info-container">
      <div className="info-header">
        <h1>About the Project</h1>
        <p>FlashValidator is an open-source demonstration of a production-grade asynchronous AI architecture.</p>
      </div>

      <div className="about-content">
        <div className="project-card fade-in-up">
          <div className="project-icon">🚀</div>
          <div className="project-details">
            <h2>The Architecture</h2>
            <p className="project-bio">
              This application showcases how to build a scalable, multi-agent AI system without compromising on user experience.
              Instead of forcing users to wait for slow LLM generations with a synchronous blocking request, this app enqueues a job 
              to a background Celery worker and returns immediately. 
            </p>
            <p className="project-bio">
              The worker executes a CrewAI sequential pipeline and streams progress directly to a PostgreSQL database. 
              The React frontend subscribes to these database changes via Supabase Realtime, creating a live, interactive 
              streaming UI without the overhead of custom WebSocket servers.
            </p>
          </div>
        </div>

        <div className="info-header" style={{ marginTop: '60px' }}>
          <h1>About the Author</h1>
        </div>

        <div className="author-card fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="author-avatar">
            <img src="https://github.com/Murugayesu.png" alt="Murugayesu A" />
          </div>
          <div className="author-details">
            <h2>Murugayesu A</h2>
            <p className="author-title">Full stack AI Product Engineer</p>
            
            <p className="author-bio">
              I built FlashValidator to solve a real problem: aspiring founders often rely on gut feeling instead of rigorous validation. 
              My goal was to create a tool that provides honest, data-backed decisions in minutes while demonstrating best practices for building 
              scalable AI SaaS products.
            </p>

            <div className="author-links">
              <a href="https://github.com/Murugayesu" target="_blank" rel="noreferrer" className="btn-secondary link-animated">
                <span className="link-icon">🐙</span> GitHub
              </a>
              <a href="https://www.linkedin.com/in/murugayesu" target="_blank" rel="noreferrer" className="btn-primary link-animated">
                <span className="link-icon">💼</span> LinkedIn
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
