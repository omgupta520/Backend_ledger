import { useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { api, newIdempotencyKey, rupees } from "../api.js"
import { useAuth } from "../auth.jsx"
import { accountLabel, useAccounts } from "../useAccounts.js"
import PinInput from "../components/PinInput.jsx"
import Receipt from "../components/Receipt.jsx"

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000]

/*
 * Step 1: who?   (UPI ID or account number + IFSC)  -> server tells us the name
 * Step 2: how much + note + which of my accounts
 * Step 3: enter PIN -> pay -> receipt
 */
export default function SendMoney() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const { accounts } = useAccounts()
  const spendable = accounts.filter(a => a.status === "ACTIVE")

  const [mode, setMode] = useState("UPI")
  const [to, setTo] = useState(params.get("to") || "")
  const [ifsc, setIfsc] = useState("LDGR0001001")
  const [payee, setPayee] = useState(null)
  const [amount, setAmount] = useState(params.get("am") || "")
  const [note, setNote] = useState("")
  const [fromAccountId, setFromAccountId] = useState("")
  const [step, setStep] = useState("PAYEE")
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [payment, setPayment] = useState(null)
  const idemKey = useRef(null)

  useEffect(() => {
    if (!fromAccountId && spendable.length) setFromAccountId(spendable[0]._id)
  }, [spendable, fromAccountId])

  // QR scan link lands here with ?to=... : look the person up straight away
  useEffect(() => { if (params.get("to")) verifyPayee() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const from = accounts.find(a => a._id === fromAccountId)

  async function verifyPayee(e) {
    e?.preventDefault()
    setBusy(true); setError("")
    try {
      const body = mode === "UPI" ? { to } : { to, ifsc }
      const { payee } = await api("/payments/resolve", { method: "POST", body })
      setPayee(payee)
      setStep("AMOUNT")
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function goToPin(e) {
    e.preventDefault()
    setError("")
    const n = Number(amount)
    if (!(n > 0)) return setError("Enter an amount")
    if (from && n > from.balance) return setError(`Not enough balance. You have ${rupees(from.balance)}`)
    idemKey.current = newIdempotencyKey() // one key per payment attempt
    setPin("")
    setStep("PIN")
  }

  async function pay(e) {
    e.preventDefault()
    setBusy(true); setError("")
    try {
      const { payment } = await api("/payments/send", {
        method: "POST",
        body: {
          fromAccountId, to, ifsc: mode === "ACCOUNT" ? ifsc : undefined,
          amount: Number(amount), note: note || undefined, pin, idempotencyKey: idemKey.current
        }
      })
      setPayment(payment)
      setStep("DONE")
    } catch (err) {
      setError(err.message)
      setPin("")
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setStep("PAYEE"); setPayee(null); setTo(""); setAmount(""); setNote(""); setPayment(null); setError("")
  }

  if (step === "DONE") return <Receipt payment={payment} onAgain={reset} />

  if (!user.hasPin) {
    return <div className="card"><h1>Send money</h1><p>First set a payment PIN.</p><Link className="btn" to="/settings">Set PIN</Link></div>
  }

  return (
    <div className="card narrow stack">
      <h1>Send money</h1>

      {step === "PAYEE" && (
        <form onSubmit={verifyPayee} className="stack">
          <div className="tabs">
            <button type="button" className={mode === "UPI" ? "on" : ""} onClick={() => setMode("UPI")}>UPI ID</button>
            <button type="button" className={mode === "ACCOUNT" ? "on" : ""} onClick={() => setMode("ACCOUNT")}>Account number</button>
          </div>
          {mode === "UPI" ? (
            <label>UPI ID<input placeholder="name1234@ledger" value={to} onChange={e => setTo(e.target.value.trim())} required /></label>
          ) : (
            <>
              <label>Account number<input inputMode="numeric" placeholder="501234567890" value={to} onChange={e => setTo(e.target.value.replace(/\D/g, ""))} required /></label>
              <label>IFSC<input value={ifsc} onChange={e => setIfsc(e.target.value.toUpperCase())} required /></label>
            </>
          )}
          {error && <div className="error">{error}</div>}
          <button className="btn" disabled={busy || !to}>{busy ? "Checking…" : "Verify"}</button>
        </form>
      )}

      {step !== "PAYEE" && payee && (
        <div className="payee">
          <div className="avatar">{payee.name[0]}</div>
          <div className="grow">
            <div className="name">{payee.name} {payee.isMerchant && <span className="tag">Merchant</span>}</div>
            <div className="muted small mono">{payee.upiId} · {payee.accountNumber}</div>
          </div>
          {step === "AMOUNT" && <button className="link" onClick={reset}>Change</button>}
        </div>
      )}

      {step === "AMOUNT" && (
        <form onSubmit={goToPin} className="stack">
          <label>Amount (₹)
            <input className="amount" inputMode="decimal" placeholder="0" value={amount} autoFocus
              onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ""))} required />
          </label>
          <div className="chips">
            {QUICK_AMOUNTS.map(a => <button type="button" key={a} onClick={() => setAmount(String(a))}>{rupees(a)}</button>)}
          </div>
          <label>Note (optional)<input maxLength={100} placeholder="Rent, dinner…" value={note} onChange={e => setNote(e.target.value)} /></label>
          <label>Pay from
            <select value={fromAccountId} onChange={e => setFromAccountId(e.target.value)}>
              {spendable.map(a => <option key={a._id} value={a._id}>{accountLabel(a)} — {rupees(a.balance)}</option>)}
            </select>
          </label>
          {error && <div className="error">{error}</div>}
          <button className="btn">Pay {amount ? rupees(amount) : ""}</button>
        </form>
      )}

      {step === "PIN" && (
        <form onSubmit={pay} className="stack center-text">
          <p>Paying <b>{rupees(amount)}</b> to <b>{payee.name}</b></p>
          <p className="muted small">Enter your payment PIN</p>
          <PinInput value={pin} onChange={setPin} autoFocus />
          {error && <div className="error">{error}</div>}
          <button className="btn" disabled={busy || pin.length < 4}>{busy ? "Paying…" : "Confirm payment"}</button>
          <button type="button" className="link" onClick={() => setStep("AMOUNT")}>Back</button>
        </form>
      )}
    </div>
  )
}
