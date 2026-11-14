const mongoose = require("mongoose")

/*
 * A merchant asks for money: "Pay ₹499 for Order #42".
 * It becomes a link / QR code. Anyone logged in can open it and pay it once.
 */
const paymentRequestSchema = new mongoose.Schema({
    merchantAccount: { type: mongoose.Schema.Types.ObjectId, ref: "account", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    note: { type: String, trim: true, maxlength: 100 },
    // merchant's own order id, handy when the request was created through the API
    reference: { type: String, trim: true, maxlength: 64 },
    source: { type: String, enum: ["DASHBOARD", "API"], default: "DASHBOARD" },
    status: { type: String, enum: ["PENDING", "PAID", "CANCELLED"], default: "PENDING", index: true },
    paidByAccount: { type: mongoose.Schema.Types.ObjectId, ref: "account" },
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: "transaction" },
    paidAt: { type: Date },
    expiresAt: { type: Date, required: true }
}, { timestamps: true })

module.exports = mongoose.model("paymentRequest", paymentRequestSchema)
