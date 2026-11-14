import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { api } from "./api.js"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const { user } = await api("/auth/me")
      setUser(user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const login = async (email, password) => {
    await api("/auth/login", { method: "POST", body: { email, password } })
    await refresh()
  }
  const register = async (name, email, password) => {
    await api("/auth/register", { method: "POST", body: { name, email, password } })
    await refresh()
  }
  const logout = async () => {
    await api("/auth/logout", { method: "POST" })
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
