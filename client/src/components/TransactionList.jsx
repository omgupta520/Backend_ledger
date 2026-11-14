import { rupees } from "../api.js"

const KIND_LABEL = {
  TRANSFER: "Transfer",
  MERCHANT_PAYMENT: "Merchant payment",
  TOPUP: "Wallet top-up",
  INITIAL_FUNDS: "Initial funds"
}

export default function TransactionList({ items }) {
  if (!items.length) return <p className="muted">No transactions yet.</p>
  return (
    <ul className="txns card">
      {items.map(t => (
        <li key={t._id}>
          <div className={"avatar " + (t.direction === "SENT" ? "out" : "in")}>
            {t.direction === "SENT" ? "↗" : "↙"}
          </div>
          <div className="grow">
            <div className="name">
              {t.kind === "TOPUP" || t.kind === "INITIAL_FUNDS"
                ? "Money added to wallet"
                : (t.direction === "SENT" ? "Paid to " : "Received from ") + (t.counterparty?.name || "")}
            </div>
            <div className="muted small">
              {KIND_LABEL[t.kind] || t.kind}{t.note ? ` · ${t.note}` : ""} · {new Date(t.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </div>
            <div className="muted tiny mono">Ref {t.referenceId}</div>
          </div>
          <div className={"amt " + (t.direction === "SENT" ? "out" : "in")}>
            {t.direction === "SENT" ? "−" : "+"}{rupees(t.amount)}
          </div>
        </li>
      ))}
    </ul>
  )
}
