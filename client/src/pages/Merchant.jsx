import { useCallback, useEffect, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { api, rupees } from "../api.js"
import { useAccounts } from "../useAccounts.js"

function OpenMerchant({ onCreated }) {
  const [businessName, setBusinessName] = useState("")
  const [error, setError] = useState("")
  const submit = async (e) => {
    e.preventDefault()
    try {
      await api("/accounts", { method: "POST", body: { type: "MERCHANT", businessName } })
      onCreated()
    } catch (err) { setError(err.message) }
  }
  return (
    <div className="card narrow stack">
      <h1>Become a merchant</h1>
      <p className="muted">Open a business account to collect payments with QR codes, payment links and an API.</p>
      <form onSubmit={submit} className="stack">
        <label>Business name<input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Meera Bakery" required /></label>
        {error && <div className="error">{error}</div>}
        <button className="btn">Open merchant account</button>
      </form>
    </div>
  )
}

function NewRequest({ account, onCreated }) {
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const submit = async (e) => {
    e.preventDefault()
    setError("")
    try {
      const { request } = await api("/merchant/requests", { method: "POST", body: { accountId: account._id, amount: Number(amount), note: note || undefined } })
      setAmount(""); setNote("")
      onCreated(request)
    } catch (err) { setError(err.message) }
  }
  return (
    <form onSubmit={submit} className="card stack">
      <h2>Request a payment</h2>
      <div className="row">
        <input className="grow" inputMode="decimal" placeholder="Amount ₹" value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ""))} required />
        <input className="grow" placeholder="What for? (Order #42)" maxLength={100} value={note} onChange={e => setNote(e.target.value)} />
      </div>
      {error && <div className="error">{error}</div>}
      <button className="btn">Create QR / payment link</button>
    </form>
  )
}

function RequestCard({ request, onCancel }) {
  return (
    <div className="card request">
      {request.status === "PENDING" && <QRCodeSVG value={request.payUrl} size={120} />}
      <div className="grow stack sm">
        <div className="row between">
          <b>{rupees(request.amount)}</b>
          <span className={"status " + request.status.toLowerCase()}>{request.status}</span>
        </div>
        {request.note && <div>{request.note}</div>}
        {request.reference && <div className="muted small">Ref: {request.reference}</div>}
        <div className="muted tiny">{request.source === "API" ? "Created via API" : "Created in dashboard"} · {new Date(request.createdAt).toLocaleString("en-IN")}</div>
        {request.status === "PENDING" && (
          <div className="row">
            <input className="grow mono tiny" readOnly value={request.payUrl} onFocus={e => e.target.select()} />
            <button className="btn ghost sm" onClick={() => navigator.clipboard?.writeText(request.payUrl)}>Copy</button>
            <button className="btn ghost sm" onClick={() => onCancel(request._id)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}

function ApiKeys({ account }) {
  const [keys, setKeys] = useState([])
  const [newKey, setNewKey] = useState("")
  const load = useCallback(() => api(`/merchant/api-keys?accountId=${account._id}`).then(d => setKeys(d.keys)), [account._id])
  useEffect(() => { load() }, [load])

  const create = async () => {
    const r = await api("/merchant/api-keys", { method: "POST", body: { accountId: account._id } })
    setNewKey(r.apiKey); load()
  }
  const revoke = async (id) => { await api(`/merchant/api-keys/${id}`, { method: "DELETE" }); load() }

  const shownKey = newKey || "lk_test_YOUR_KEY"
  const base = window.location.origin
  return (
    <section className="card stack">
      <div className="row between"><h2>Developer API</h2><button className="btn sm" onClick={create}>Generate API key</button></div>
      {newKey && (
        <div className="banner">Copy this key now — it will not be shown again:<br /><code className="mono">{newKey}</code></div>
      )}
      {keys.length > 0 && (
        <ul className="plain">
          {keys.map(k => (
            <li key={k._id} className="row between">
              <span className="mono">{k.prefix}…</span>
              <span className="muted tiny">{k.lastUsedAt ? "last used " + new Date(k.lastUsedAt).toLocaleString("en-IN") : "never used"}</span>
              <button className="link" onClick={() => revoke(k._id)}>Revoke</button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">Create a payment link from your own website's server:</p>
      <pre>{`curl -X POST ${base}/api/v1/payment-links \\
  -H "Authorization: Bearer ${shownKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 499, "note": "Order #42", "reference": "ORDER-42"}'

# send your customer to "payUrl", then check:
curl ${base}/api/v1/payment-links/<id> -H "Authorization: Bearer ${shownKey}"`}</pre>
    </section>
  )
}

export default function Merchant() {
  const { accounts, loading, reload } = useAccounts()
  const merchants = accounts.filter(a => a.type === "MERCHANT")
  const [selectedId, setSelectedId] = useState("")
  const [requests, setRequests] = useState([])
  const account = merchants.find(a => a._id === selectedId) || merchants[0]

  const loadRequests = useCallback(() => {
    if (account) api(`/merchant/requests?accountId=${account._id}`).then(d => setRequests(d.requests))
  }, [account?._id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadRequests() }, [loadRequests])
  // refresh every 5s so the merchant sees "PAID" appear without reloading
  useEffect(() => {
    const t = setInterval(() => { loadRequests(); reload() }, 5000)
    return () => clearInterval(t)
  }, [loadRequests, reload])

  if (loading) return <p className="muted">Loading…</p>
  if (!account) return <OpenMerchant onCreated={reload} />

  const cancel = async (id) => { await api(`/merchant/requests/${id}/cancel`, { method: "POST" }); loadRequests() }

  return (
    <div className="stack lg">
      <div className="row between">
        <h1>{account.businessName}</h1>
        {merchants.length > 1 && (
          <select value={account._id} onChange={e => setSelectedId(e.target.value)}>
            {merchants.map(m => <option key={m._id} value={m._id}>{m.businessName}</option>)}
          </select>
        )}
      </div>
      <div className="card row between wrap">
        <div><div className="muted small">Collected balance</div><div className="balance">{rupees(account.balance)}</div></div>
        <div className="mono small">{account.upiId}<br />A/c {account.accountNumber} · {account.ifsc}</div>
      </div>
      <NewRequest account={account} onCreated={() => loadRequests()} />
      <section className="stack">
        <h2>Payment requests</h2>
        {requests.length === 0 ? <p className="muted">No requests yet.</p> :
          requests.map(r => <RequestCard key={r._id} request={r} onCancel={cancel} />)}
      </section>
      <ApiKeys account={account} />
    </div>
  )
}
