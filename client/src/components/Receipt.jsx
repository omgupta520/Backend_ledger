import { Link } from "react-router-dom"
import { rupees } from "../api.js"

export default function Receipt({ payment, onAgain }) {
  return (
    <div className="card receipt">
      <div className="tick">✓</div>
      <h2>{rupees(payment.amount)} paid</h2>
      <p className="muted">to <b>{payment.paidTo?.name}</b>{payment.paidTo?.upiId ? ` · ${payment.paidTo.upiId}` : ""}</p>
      <dl className="kv">
        <dt>Reference no.</dt><dd className="mono">{payment.referenceId}</dd>
        {payment.note && (<><dt>Note</dt><dd>{payment.note}</dd></>)}
        <dt>Time</dt><dd>{new Date(payment.createdAt).toLocaleString("en-IN")}</dd>
        <dt>Status</dt><dd className="ok">{payment.status}</dd>
      </dl>
      <div className="row">
        {onAgain && <button className="btn ghost" onClick={onAgain}>Pay again</button>}
        <Link className="btn" to="/">Done</Link>
      </div>
    </div>
  )
}
