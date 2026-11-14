import { useState } from "react"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../auth.jsx"

export default function Register() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const from = useLocation().state?.from || "/"
  const [form, setForm] = useState({ name: "", email: "", password: "" })
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={from} replace />
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError("")
    try {
      await register(form.name, form.email, form.password)
      navigate("/settings?welcome=1", { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-card card">
      <div className="brand big">Ledger<span>Pay</span></div>
      <p className="muted">You get an account number and a UPI ID right away.</p>
      <form onSubmit={submit} className="stack">
        <label>Full name<input value={form.name} onChange={set("name")} required /></label>
        <label>Email<input type="email" value={form.email} onChange={set("email")} required /></label>
        <label>Password<input type="password" minLength={6} value={form.password} onChange={set("password")} required /></label>
        {error && <div className="error">{error}</div>}
        <button className="btn" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
      </form>
      <p className="muted small">Already have one? <Link to="/login" state={{ from }}>Log in</Link></p>
    </div>
  )
}
