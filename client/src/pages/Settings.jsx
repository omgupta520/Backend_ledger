import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { api } from "../api.js"
import { useAuth } from "../auth.jsx"
import PinInput from "../components/PinInput.jsx"

export default function Settings() {
  const { user, refresh } = useAuth()
  const welcome = useSearchParams()[0].get("welcome")
  const [password, setPassword] = useState("")
  const [pin, setPin] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(""); setMessage("")
    if (pin !== confirm) return setError("PINs do not match")
    setBusy(true)
    try {
      const r = await api("/auth/pin", { method: "POST", body: { password, pin } })
      setMessage(r.message); setPassword(""); setPin(""); setConfirm("")
      refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card narrow stack">
      {welcome && <div className="success">Account created! Your UPI ID and account number are on the Home page.</div>}
      <h1>{user.hasPin ? "Change payment PIN" : "Set payment PIN"}</h1>
      <p className="muted small">You will enter this 4 or 6 digit PIN every time you pay. Never share it.</p>
      <form onSubmit={submit} className="stack">
        <label>Login password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        <label>New PIN<PinInput value={pin} onChange={setPin} /></label>
        <label>Confirm PIN<PinInput value={confirm} onChange={setConfirm} /></label>
        {error && <div className="error">{error}</div>}
        {message && <div className="success">{message}</div>}
        <button className="btn" disabled={busy || pin.length < 4}>{busy ? "Saving…" : "Save PIN"}</button>
      </form>
    </div>
  )
}
