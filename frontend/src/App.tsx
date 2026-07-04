import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import ValidatePage from './pages/ValidatePage'
import RunPage from './pages/RunPage'
import HistoryPage from './pages/HistoryPage'
import './styles/App.css'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuthStore()
  if (loading) return <div className="full-page-loader"><div className="loader-spinner" /></div>
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

function NavBar() {
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  if (!user) return null

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="nav-logo">⚡</span>
        <span className="nav-name">IdeaValidator</span>
      </div>
      <div className="navbar-links">
        <NavLink to="/validate" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} id="nav-validate">
          Validate
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} id="nav-history">
          My Runs
        </NavLink>
      </div>
      <div className="navbar-user">
        <img
          src={user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${user.email}`}
          alt="avatar"
          className="user-avatar"
        />
        <button className="signout-btn" onClick={handleSignOut} id="signout-btn">Sign out</button>
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
          <Route path="/login" element={<LoginPage />} />
          <Route path="/validate" element={<RequireAuth><ValidatePage /></RequireAuth>} />
          <Route path="/run/:runId" element={<RequireAuth><RunPage /></RequireAuth>} />
          <Route path="/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/validate" replace />} />
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
