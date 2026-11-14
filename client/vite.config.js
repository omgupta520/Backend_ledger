import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// In development the React app runs on :5173 and forwards /api calls to Express on :3000.
// Same origin for the browser = the login cookie just works, no CORS setup needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": process.env.BACKEND_URL || "http://localhost:3000"
    }
  }
})
