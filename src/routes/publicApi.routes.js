const { Router } = require("express")
const { apiKeyMiddleware } = require("../middleware/apiKey.middleware")
const api = require("../controllers/publicApi.controller")

// /api/v1/*  -> used by merchants from their own servers with an API key
const router = Router()
router.use(apiKeyMiddleware)

router.post("/payment-links", api.createPaymentLink)
router.get("/payment-links", api.listPaymentLinks)
router.get("/payment-links/:id", api.getPaymentLink)

module.exports = router
