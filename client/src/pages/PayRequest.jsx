import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { api, rupees } from "../api.js"
import { useAuth } from "../auth.jsx"
import { accountLabel, useAccounts } from "../useAccounts.js"
import PinInput from "../components/PinInput.jsx"
import Receipt from "../components/Receipt.jsx"

// the page a customer lands on after scanning a merchant QR / opening a payment link
export default function PayRequest() {
  const { id } = useParams()
  const { user } = useAuth()
  const { accounts } = useAccounts()
  const [request, setRequest] = useState(null)
  const [fromAccountId, setFromAccountId] = useState("")
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [payment, setPayment] = useState(null)

  useEffect(() => {
    api(`/payments/requests/${id}`).then(d => setRequest(d.request)).catch(err => setError(err.message))
  }, [id])
  useEffect(() => {
    const first = accounts.find(a => a.status === "ACTIVE")
    if (!fromAccountId && first) setFromAccountId(first._id)
  }, [accounts, fromAccountId])

  async function pay(e) {
    e.preventDefault()
    setBusy(true); setError("")
    try {
      const { payment } = await api(`/payments/requests/${id}/pay`, { method: "POST", body: { fromAccountId, pin } })
      setPayment(payment)
    } catch (err) {
      setError(err.message); setPin("")
    } finally {
      setBusy(false)
    }
  }

  if (payment) return <Receipt payment={payment} />
  if (!request) return <div className="card narrow">{error ? <div className="error">{error}</div> : <p className="muted">Loading…</p>}</div>

  const from = accounts.find(a => a._id === fromAccountId)
  return (
    <div className="card narrow stack center-text">
      <div className="avatar big">{request.merchant.name[0]}</div>
      <div>
        <div className="muted small">Paying</div>
        <h2>{request.merchant.name}</h2>
        <div className="muted small mono">{request.merchant.upiId}</div>
      </div>
      <div className="balance">{rupees(request.amount)}</div>
      {request.note && <p>{request.note}</p>}

      {request.status !== "PENDING" ? (
        <div className="banner">This request is <b>{request.status.toLowerCase()}</b>.</div>
      ) : !user.hasPin ? (
        <Link className="btn" to="/settings">Set payment PIN to continue</Link>
      ) : (
        <form onSubmit={pay} className="stack">
          <select value={fromAccountId} onChange={e => setFromAccountId(e.target.value)}>
            {accounts.filter(a => a.status === "ACTIVE").map(a => <option key={a._id} value={a._id}>{accountLabel(a)} — {rupees(a.balance)}</option>)}
          </select>
          {from && from.balance < request.amount && (
            <div className="error">Not enough balance. <Link to="/add-money">Add money</Link></div>
          )}
          <PinInput value={pin} onChange={setPin} />
          {error && <div className="error">{error}</div>}
          <button className="btn" disabled={busy || pin.length < 4}>{busy ? "Paying…" : `Pay ${rupees(request.amount)}`}</button>
        </form>
      )}
    </div>
  )
}
