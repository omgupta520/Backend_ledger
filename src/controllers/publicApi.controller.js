const paymentRequestModel = require("../models/paymentRequest.model")
const { createRequestFor, requestView } = require("./merchant.controller")
const AppError = require("../utils/AppError")

/*
 * MERCHANT PUBLIC API (v1) - called from the merchant's own server with an API key.
 *
 *   curl -X POST http://localhost:3000/api/v1/payment-links \
 *     -H "Authorization: Bearer lk_test_xxx" -H "Content-Type: application/json" \
 *     -d '{"amount": 499, "note": "Order #42", "reference": "ORDER-42"}'
 *
 * Send your customer to the returned payUrl. Then poll GET /api/v1/payment-links/:id for status.
 */

/* POST /api/v1/payment-links */
async function createPaymentLink(req, res) {
    const link = await createRequestFor(req.merchantAccount, { ...req.body, source: "API" })
    res.status(201).json(link)
}

/* GET /api/v1/payment-links/:id */
async function getPaymentLink(req, res) {
    const link = await paymentRequestModel.findOne({ _id: req.params.id, merchantAccount: req.merchantAccount._id })
    if (!link) throw new AppError(404, "Payment link not found")
    res.json(requestView(link))
}

/* GET /api/v1/payment-links?status=PAID */
async function listPaymentLinks(req, res) {
    const filter = { merchantAccount: req.merchantAccount._id }
    if (req.query.status) filter.status = String(req.query.status).toUpperCase()
    const links = await paymentRequestModel.find(filter).sort({ createdAt: -1 }).limit(100)
    res.json({ data: links.map(requestView) })
}

module.exports = { createPaymentLink, getPaymentLink, listPaymentLinks }
