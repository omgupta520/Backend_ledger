const { Router } = require("express")
const { authMiddleware } = require("../middleware/auth.middleware")
const payment = require("../controllers/payment.controller")

const router = Router()

/* POST /api/payments/resolve      check who you are paying (UPI id / account number) */
router.post("/resolve", authMiddleware, payment.resolvePayee)

/* POST /api/payments/send         pay anyone by UPI id / account number + PIN */
router.post("/send", authMiddleware, payment.sendMoney)

/* GET  /api/payments/requests/:id  open a merchant payment link (public) */
router.get("/requests/:id", payment.getPaymentRequest)

/* POST /api/payments/requests/:id/pay   pay a merchant payment link */
router.post("/requests/:id/pay", authMiddleware, payment.payPaymentRequest)

module.exports = router
