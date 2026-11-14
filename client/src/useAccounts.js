import { useCallback, useEffect, useState } from "react"
import { api } from "./api.js"

export function useAccounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const reload = useCallback(async () => {
    try {
      const { accounts } = await api("/accounts")
      setAccounts(accounts)
      setError("")
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])
  return { accounts, loading, error, reload }
}

export const accountLabel = (a) =>
  `${a.type === "MERCHANT" ? a.businessName : "Personal"} · XXXX${a.accountNumber?.slice(-4)}`
