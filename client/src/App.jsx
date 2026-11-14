import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom"
import { useAuth } from "./auth.jsx"
import Login from "./pages/Login.jsx"
import Register from "./pages/Register.jsx"
import Dashboard from "./pages/Dashboard.jsx"
import SendMoney from "./pages/SendMoney.jsx"
import AddMoney from "./pages/AddMoney.jsx"
import History from "./pages/History.jsx"
import Merchant from "./pages/Merchant.jsx"
import PayRequest from "./pages/PayRequest.jsx"
import Settings from "./pages/Settings.jsx"

function Protected({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="center muted">Loading…</div>
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  return children
}

function Nav() {
  const { user, logout } = useAuth()
  if (!user) return null
  return (
    <header className="nav">
      <div className="brand">Ledger<span>Pay</span></div>
      <nav>
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/send">Send</NavLink>
        <NavLink to="/add-money">Add money</NavLink>
        <NavLink to="/history">History</NavLink>
        <NavLink to="/merchant">Merchant</NavLink>
        <NavLink to="/settings">PIN</NavLink>
      </nav>
      <button className="link" onClick={logout}>Log out</button>
    </header>
  )
}

export default function App() {
  return (
    <>
      <Nav />
      <main className="container">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/send" element={<Protected><SendMoney /></Protected>} />
          <Route path="/add-money" element={<Protected><AddMoney /></Protected>} />
          <Route path="/history" element={<Protected><History /></Protected>} />
          <Route path="/merchant" element={<Protected><Merchant /></Protected>} />
          <Route path="/settings" element={<Protected><Settings /></Protected>} />
          <Route path="/pay/request/:id" element={<Protected><PayRequest /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}
