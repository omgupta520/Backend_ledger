const apiKeyModel = require("../models/apiKey.model")
const accountModel = require("../models/account.model")
const { hashKey } = require("../controllers/merchant.controller")

/*
 * For the merchant public API. Reads the key from
 *   Authorization: Bearer lk_test_xxx     or     x-api-key: lk_test_xxx
 */
async function apiKeyMiddleware(req, res, next) {
    const header = req.headers.authorization || ""
    const key = header.startsWith("Bearer ") ? header.slice(7) : req.headers["x-api-key"]
    if (!key || !key.startsWith("lk_")) {
        return res.status(401).json({ message: "API key missing" })
    }
    const apiKey = await apiKeyModel.findOne({ keyHash: hashKey(key), revoked: false })
    if (!apiKey) return res.status(401).json({ message: "Invalid API key" })

    const account = await accountModel.findById(apiKey.merchantAccount)
    if (!account || account.status !== "ACTIVE") {
        return res.status(403).json({ message: "Merchant account is not active" })
    }
    apiKeyModel.updateOne({ _id: apiKey._id }, { lastUsedAt: new Date() }).catch(() => {})
    req.merchantAccount = account
    next()
}

module.exports = { apiKeyMiddleware }
