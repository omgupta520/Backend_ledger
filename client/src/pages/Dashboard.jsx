import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { QRCodeSVG } from "qrcode.react"
import { api, rupees } from "../api.js"
import { useAuth } from "../auth.jsx"
import { useAccounts } from "../useAccounts.js"
import TransactionList from "../components/TransactionList.jsx"

function CopyText({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button className="copy" onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200) }}>
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

function AccountCard({ account }) {
  const [showQr, setShowQr] = useState(false)
  // scanning this QR opens our Send page with the UPI id already filled in
  const qrValue = `${window.location.origin}/send?to=${encodeURIComponent(account.upiId)}`
  return (
    <div className={"card account " + account.type.toLowerCase()}>
      <div className="row between">
        <span className="tag">{account.type === "MERCHANT" ? account.businessName : "Personal account"}</span>
        <span className="muted small">{account.status}</span>
      </div>
      <div className="balance">{rupees(account.balance)}</div>
      <dl className="kv">
        <dt>UPI ID</dt><dd className="mono">{account.upiId} <CopyText text={account.upiId} /></dd>
        <dt>Account no.</dt><dd className="mono">{account.accountNumber} <CopyText text={account.accountNumber} /></dd>
        <dt>IFSC</dt><dd className="mono">{account.ifsc}</dd>
      </dl>
      <button className="link" onClick={() => setShowQr(!showQr)}>{showQr ? "Hide" : "Show"} my QR to receive money</button>
      {showQr && (
        <div className="qr">
          <QRCodeSVG value={qrValue} size={160} />
          <span className="muted small">Scan to pay {account.upiId}</span>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { accounts, loading, error } = useAccounts()
  const [recent, setRecent] = useState([])

  useEffect(() => {
    api("/transactions?limit=5").then(d => setRecent(d.items)).catch(() => {})
  }, [])

  return (
    <div className="stack lg">
      <div>
        <h1>Hi, {user.name.split(" ")[0]}</h1>
        {!user.hasPin && (
          <div className="banner">Set your payment PIN before you send money. <Link to="/settings">Set PIN →</Link></div>
        )}
      </div>

      <div className="actions">
        <Link className="action" to="/send"><span>↗</span>Send money</Link>
        <Link className="action" to="/add-money"><span>＋</span>Add money</Link>
        <Link className="action" to="/merchant"><span>▦</span>Collect payment</Link>
        <Link className="action" to="/history"><span>≡</span>History</Link>
      </div>

      {loading ? <p className="muted">Loading accounts…</p> : error ? <div className="error">{error}</div> : (
        <div className="grid">
          {accounts.map(a => <AccountCard key={a._id} account={a} />)}
        </div>
      )}

      <section>
        <div className="row between"><h2>Recent activity</h2><Link to="/history">See all</Link></div>
        <TransactionList items={recent} />
      </section>
    </div>
  )
}
