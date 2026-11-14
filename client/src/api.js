// Tiny wrapper around fetch. The login token travels in an httpOnly cookie automatically.
export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch("/api" + path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  })
  let data = null
  try { data = await res.json() } catch { /* empty body */ }
  if (!res.ok) {
    const err = new Error(data?.message || `Request failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return data
}

// a fresh key per "Pay" click; retries of the same click reuse it so you are never charged twice
export const newIdempotencyKey = () => crypto.randomUUID()

export const rupees = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
