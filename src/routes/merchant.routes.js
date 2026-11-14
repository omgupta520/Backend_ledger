const { Router } = require("express")
const { authMiddleware } = require("../middleware/auth.middleware")
const merchant = require("../controllers/merchant.controller")

const router = Router()
router.use(authMiddleware)

router.post("/requests", merchant.createPaymentRequest)
router.get("/requests", merchant.listPaymentRequests)
router.post("/requests/:id/cancel", merchant.cancelPaymentRequest)

router.post("/api-keys", merchant.createApiKey)
router.get("/api-keys", merchant.listApiKeys)
router.delete("/api-keys/:id", merchant.revokeApiKey)

module.exports = router
