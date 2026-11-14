import { useEffect, useState } from "react"
import { api, rupees } from "../api.js"
import { accountLabel, useAccounts } from "../useAccounts.js"

// load Razorpay's checkout popup script only when needed
function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve()
    const s = document.createElement("script")
    s.src = "https://checkout.razorpay.com/v1/checkout.js"
    s.onload = resolve
    s.onerror = () => reject(new Error("Could not load Razorpay"))
    document.body.appendChild(s)
  })
}

/*
 * 1. ask our server to create an order
 * 2. RAZORPAY mode: open checkout popup -> user pays with UPI/card -> we send the signature to /verify
 *    MOCK mode: show a fake "bank" screen with Success / Fail buttons
 */
export default function AddMoney() {
  const { accounts, reload } = useAccounts()
  const [config, setConfig] = useState(null)
  const [accountId, setAccountId] = useState("")
  const [amount, setAmount] = useState("")
  const [mockOrder, setMockOrder] = useState(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => { api("/topup/config").then(setConfig) }, [])
  useEffect(() => { if (!accountId && accounts.length) setAccountId(accounts[0]._id) }, [accounts, accountId])

  async function start(e) {
    e.preventDefault()
    setBusy(true); setError(""); setMessage("")
    try {
      const order = await api("/topup/order", { method: "POST", body: { accountId, amount: Number(amount) } })
      if (order.mode === "MOCK") {
        setMockOrder(order)
        return
      }
      await loadRazorpay()
      const rzp = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountInPaise,
        currency: "INR",
        name: "LedgerPay",
        description: "Add money to wallet",
        prefill: { name: order.name, email: order.email },
        handler: async (resp) => {
          try {
            const r = await api("/topup/verify", {
              method: "POST",
              body: { orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature }
            })
            setMessage(r.message); setAmount(""); reload()
          } catch (err) { setError(err.message) }
        },
        modal: { ondismiss: () => setBusy(false) }
      })
      rzp.on("payment.failed", (resp) => setError(resp.error?.description || "Payment failed"))
      rzp.open()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function finishMock(success) {
    if (!success) {
      setMockOrder(null); setError("Payment cancelled at the bank (test)")
      return
    }
    setBusy(true)
    try {
      const r = await api("/topup/verify", { method: "POST", body: { orderId: mockOrder.orderId, mock: true } })
      setMessage(r.message); setAmount(""); setMockOrder(null); reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (mockOrder) {
    return (
      <div className="card narrow stack center-text mock-bank">
        <span className="tag warn">TEST GATEWAY</span>
        <h2>Pay {rupees(mockOrder.amount)}</h2>
        <p className="muted small">This screen stands in for Razorpay while no API keys are set. Order <span className="mono">{mockOrder.orderId}</span></p>
        <div className="row">
          <button className="btn ghost" onClick={() => finishMock(false)} disabled={busy}>Fail</button>
          <button className="btn" onClick={() => finishMock(true)} disabled={busy}>Pay (success)</button>
        </div>
      </div>
    )
  }

  return (
    <div className="card narrow stack">
      <h1>Add money</h1>
      {config && (
        <p className="muted small">
          Gateway: <b>{config.mode === "RAZORPAY" ? "Razorpay" : "Test gateway (no Razorpay keys set)"}</b>
        </p>
      )}
      <form onSubmit={start} className="stack">
        <label>To account
          <select value={accountId} onChange={e => setAccountId(e.target.value)}>
            {accounts.map(a => <option key={a._id} value={a._id}>{accountLabel(a)} — {rupees(a.balance)}</option>)}
          </select>
        </label>
        <label>Amount (₹)
          <input className="amount" inputMode="decimal" placeholder="0" value={amount}
            onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ""))} required />
        </label>
        <div className="chips">
          {[500, 1000, 5000].map(a => <button type="button" key={a} onClick={() => setAmount(String(a))}>{rupees(a)}</button>)}
        </div>
        {error && <div className="error">{error}</div>}
        {message && <div className="success">{message}</div>}
        <button className="btn" disabled={busy || !accountId}>{busy ? "Please wait…" : "Proceed to pay"}</button>
      </form>
    </div>
  )
}
