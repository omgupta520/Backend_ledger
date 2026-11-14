import { useEffect, useState } from "react"
import { api } from "../api.js"
import { accountLabel, useAccounts } from "../useAccounts.js"
import TransactionList from "../components/TransactionList.jsx"

export default function History() {
  const { accounts } = useAccounts()
  const [accountId, setAccountId] = useState("")
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api("/transactions?limit=100" + (accountId ? `&accountId=${accountId}` : ""))
      .then(d => setItems(d.items))
      .finally(() => setLoading(false))
  }, [accountId])

  return (
    <div className="stack lg">
      <div className="row between">
        <h1>History</h1>
        {accounts.length > 1 && (
          <select value={accountId} onChange={e => setAccountId(e.target.value)}>
            <option value="">All accounts</option>
            {accounts.map(a => <option key={a._id} value={a._id}>{accountLabel(a)}</option>)}
          </select>
        )}
      </div>
      {loading ? <p className="muted">Loading…</p> : <TransactionList items={items} />}
    </div>
  )
}
