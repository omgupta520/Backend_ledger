const mongoose = require("mongoose")

/*
 * Merchant API key. Lets a merchant's own website create payment links by code.
 * We only keep a SHA-256 hash of the key (like a password), never the key itself.
 */
const apiKeySchema = new mongoose.Schema({
    merchantAccount: { type: mongoose.Schema.Types.ObjectId, ref: "account", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    name: { type: String, trim: true, default: "Default key" },
    prefix: { type: String, required: true },                 // first characters, shown in the dashboard
    keyHash: { type: String, required: true, unique: true },
    revoked: { type: Boolean, default: false },
    lastUsedAt: { type: Date }
}, { timestamps: true })

module.exports = mongoose.model("apiKey", apiKeySchema)
