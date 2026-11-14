const { Router } = require("express")
const { authMiddleware } = require("../middleware/auth.middleware")
const topup = require("../controllers/topup.controller")

const router = Router()

// NOTE: POST /api/topup/webhook is registered in app.js because it needs the raw body

router.get("/config", topup.topupConfig)
router.post("/order", authMiddleware, topup.createTopupOrder)
router.post("/verify", authMiddleware, topup.verifyTopup)

module.exports = router
