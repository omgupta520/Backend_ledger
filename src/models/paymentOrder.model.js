const mongoose = require("mongoose")

/*
 * "Add money" order. Real money comes in through a payment gateway (Razorpay).
 * Flow: CREATED -> (user pays on Razorpay) -> PAID  (wallet credited exactly once)
 */
const paymentOrderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: "account", required: true },
    amount: { type: Number, required: true, min: 1 },          // rupees
    currency: { type: String, default: "INR" },
    gateway: { type: String, enum: ["RAZORPAY", "MOCK"], required: true },
    gatewayOrderId: { type: String, required: true, unique: true },
    gatewayPaymentId: { type: String },
    status: { type: String, enum: ["CREATED", "PAID", "FAILED"], default: "CREATED" },
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: "transaction" }
}, { timestamps: true })

module.exports = mongoose.model("paymentOrder", paymentOrderSchema)
