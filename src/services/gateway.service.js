const crypto = require("crypto")
const { toPaise } = require("../utils/money")

/*
 * Payment gateway wrapper.
 *
 *  - RAZORPAY mode: when RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET are set (use TEST keys while learning).
 *    The user pays with real UPI / card / netbanking on Razorpay's checkout popup.
 *  - MOCK mode: no keys and not production. A fake gateway so you can build & test without any account.
 */
const KEY_ID = process.env.RAZORPAY_KEY_ID
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET

let razorpay = null
if (KEY_ID && KEY_SECRET) {
    const Razorpay = require("razorpay")
    razorpay = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET })
}

const mode = () => (razorpay ? "RAZORPAY" : "MOCK")
const mockAllowed = () => !razorpay && process.env.NODE_ENV !== "production"

async function createOrder({ amount, receipt }) {
    if (razorpay) {
        const order = await razorpay.orders.create({
            amount: toPaise(amount),
            currency: "INR",
            receipt
        })
        return { gateway: "RAZORPAY", gatewayOrderId: order.id, keyId: KEY_ID }
    }
    if (!mockAllowed()) {
        throw new Error("Payment gateway is not configured (set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)")
    }
    return { gateway: "MOCK", gatewayOrderId: "mock_order_" + crypto.randomBytes(8).toString("hex") }
}

const safeEqual = (a, b) => {
    const x = Buffer.from(String(a || ""))
    const y = Buffer.from(String(b || ""))
    return x.length === y.length && crypto.timingSafeEqual(x, y)
}

/*
 * After checkout Razorpay gives the browser { order_id, payment_id, signature }.
 * signature = HMAC_SHA256(order_id + "|" + payment_id, KEY_SECRET)
 * Only Razorpay and our server know KEY_SECRET, so a correct signature proves the payment is real.
 */
function verifyCheckoutSignature({ orderId, paymentId, signature }) {
    if (!KEY_SECRET) return false
    const expected = crypto.createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex")
    return safeEqual(expected, signature)
}

// webhook = Razorpay's server calling our server directly (works even if the user closes the browser)
function verifyWebhookSignature(rawBody, signature) {
    if (!WEBHOOK_SECRET) return false
    const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex")
    return safeEqual(expected, signature)
}

module.exports = { mode, mockAllowed, createOrder, verifyCheckoutSignature, verifyWebhookSignature }
