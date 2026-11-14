const crypto = require("crypto")
const accountModel = require("../models/account.model")
const paymentRequestModel = require("../models/paymentRequest.model")
const apiKeyModel = require("../models/apiKey.model")
const { parseAmount } = require("../utils/money")
const AppError = require("../utils/AppError")

const APP_URL = () => process.env.APP_URL || "http://localhost:5173"
const payUrl = (id) => `${APP_URL()}/pay/request/${id}`

async function getMerchantAccount(userId, accountId) {
    const account = await accountModel.findOne({ _id: accountId, user: userId, type: "MERCHANT" })
    if (!account) throw new AppError(404, "Merchant account not found")
    return account
}

const requestView = (r) => ({
    _id: r._id,
    amount: r.amount,
    note: r.note,
    reference: r.reference,
    source: r.source,
    status: r.status === "PENDING" && r.expiresAt < new Date() ? "EXPIRED" : r.status,
    payUrl: payUrl(r._id),
    expiresAt: r.expiresAt,
    paidAt: r.paidAt,
    createdAt: r.createdAt
})

// shared by dashboard + public API
async function createRequestFor(merchantAccount, { amount, note, reference, expiresInMinutes, source }) {
    const minutes = Math.min(Math.max(Number(expiresInMinutes) || 60 * 24, 5), 60 * 24 * 30)
    const request = await paymentRequestModel.create({
        merchantAccount: merchantAccount._id,
        amount: parseAmount(amount),
        note,
        reference,
        source,
        expiresAt: new Date(Date.now() + minutes * 60 * 1000)
    })
    return requestView(request)
}

/* POST /api/merchant/requests  { accountId, amount, note?, reference?, expiresInMinutes? } */
async function createPaymentRequest(req, res) {
    const account = await getMerchantAccount(req.user._id, req.body.accountId)
    const request = await createRequestFor(account, { ...req.body, source: "DASHBOARD" })
    res.status(201).json({ request })
}

/* GET /api/merchant/requests?accountId=... */
async function listPaymentRequests(req, res) {
    const account = await getMerchantAccount(req.user._id, req.query.accountId)
    const requests = await paymentRequestModel.find({ merchantAccount: account._id }).sort({ createdAt: -1 }).limit(100)
    res.json({ requests: requests.map(requestView) })
}

/* POST /api/merchant/requests/:id/cancel */
async function cancelPaymentRequest(req, res) {
    const request = await paymentRequestModel.findById(req.params.id)
    if (!request) throw new AppError(404, "Payment request not found")
    await getMerchantAccount(req.user._id, request.merchantAccount)
    const updated = await paymentRequestModel.findOneAndUpdate(
        { _id: request._id, status: "PENDING" }, { status: "CANCELLED" }, { new: true })
    if (!updated) throw new AppError(409, "Only pending requests can be cancelled")
    res.json({ request: requestView(updated) })
}

const hashKey = (key) => crypto.createHash("sha256").update(key).digest("hex")

/* POST /api/merchant/api-keys  { accountId, name? }  -> the full key is shown ONLY ONCE */
async function createApiKey(req, res) {
    const account = await getMerchantAccount(req.user._id, req.body.accountId)
    const env = process.env.NODE_ENV === "production" ? "live" : "test"
    const key = `lk_${env}_${crypto.randomBytes(24).toString("hex")}`
    const doc = await apiKeyModel.create({
        merchantAccount: account._id,
        user: req.user._id,
        name: req.body.name || "Default key",
        prefix: key.slice(0, 16),
        keyHash: hashKey(key)
    })
    res.status(201).json({
        apiKey: key,
        key: { _id: doc._id, name: doc.name, prefix: doc.prefix, createdAt: doc.createdAt },
        message: "Copy this key now. You will not see it again."
    })
}

/* GET /api/merchant/api-keys?accountId=... */
async function listApiKeys(req, res) {
    const account = await getMerchantAccount(req.user._id, req.query.accountId)
    const keys = await apiKeyModel.find({ merchantAccount: account._id, revoked: false }).sort({ createdAt: -1 })
    res.json({ keys: keys.map(k => ({ _id: k._id, name: k.name, prefix: k.prefix, lastUsedAt: k.lastUsedAt, createdAt: k.createdAt })) })
}

/* DELETE /api/merchant/api-keys/:id */
async function revokeApiKey(req, res) {
    const result = await apiKeyModel.updateOne({ _id: req.params.id, user: req.user._id }, { revoked: true })
    if (!result.matchedCount) throw new AppError(404, "API key not found")
    res.json({ message: "API key revoked" })
}

module.exports = {
    createPaymentRequest, listPaymentRequests, cancelPaymentRequest,
    createApiKey, listApiKeys, revokeApiKey,
    createRequestFor, requestView, hashKey
}
