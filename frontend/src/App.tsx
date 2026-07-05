import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import ValidatePage from './pages/ValidatePage'
import RunPage from './pages/RunPage'
import HistoryPage from './pages/HistoryPage'
import LandingPage from './pages/LandingPage'
import AgentsPage from './pages/AgentsPage'
import AboutPage from './pages/AboutPage'
import { useTheme } from './hooks/useTheme'
import './styles/App.css'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuthStore()
  if (loading) return <div className="full-page-loader"><div className="loader-spinner" /></div>
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

function NavBar() {
  const { user, signOut } = useAuthStore()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <span className="nav-logo">⚡</span>
        <span className="nav-name">IdeaValidator</span>
      </div>
      <div className="navbar-links">
        <NavLink to="/validate" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} id="nav-validate">
          Validate
        </NavLink>
        {user && (
          <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} id="nav-history">
            My Runs
          </NavLink>
        )}
        <NavLink to="/agents" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} id="nav-agents">
          Agents
        </NavLink>
        <NavLink to="/about" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} id="nav-about">
          About
        </NavLink>
      </div>
      <div className="navbar-user">
        <button onClick={toggleTheme} className="theme-toggle-btn" aria-label="Toggle theme">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        {user ? (
          <>
            <img
              src={user.user_metadata?.avatar_url || `https://api.dicebear.com/9.x/initials/svg?seed=${user.email}`}
              alt="avatar"
              className="user-avatar"
              onError={(e) => {
                // If the OAuth avatar fails to load (e.g., expired link), fallback to DiceBear initials
                e.currentTarget.src = `https://api.dicebear.com/9.x/initials/svg?seed=${user.email}`
              }}
            />
            <button className="signout-btn" onClick={handleSignOut} id="signout-btn">Sign out</button>
          </>
        ) : (
          <button className="signout-btn" onClick={() => navigate('/login')} id="signin-btn">Sign In</button>
        )}
      </div>
    </nav>
  )
}

function AppRoutes() {
  return (
    <>
      <NavBar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/validate" element={<RequireAuth><ValidatePage /></RequireAuth>} />
          <Route path="/run/:runId" element={<RequireAuth><RunPage /></RequireAuth>} />
          <Route path="/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
