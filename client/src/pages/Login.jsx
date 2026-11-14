import { useState } from "react"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../auth.jsx"

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const from = useLocation().state?.from || "/"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={from} replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError("")
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-card card">
      <div className="brand big">Ledger<span>Pay</span></div>
      <p className="muted">Pay anyone with a UPI ID or account number.</p>
      <form onSubmit={submit} className="stack">
        <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        {error && <div className="error">{error}</div>}
        <button className="btn" disabled={busy}>{busy ? "Signing in…" : "Log in"}</button>
      </form>
      <p className="muted small">New here? <Link to="/register" state={{ from }}>Create an account</Link></p>
    </div>
  )
}
