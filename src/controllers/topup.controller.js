const accountModel = require("../models/account.model")
const paymentOrderModel = require("../models/paymentOrder.model")
const gateway = require("../services/gateway.service")
const { transfer, getSystemAccount } = require("../services/ledger.service")
const { parseAmount } = require("../utils/money")
const AppError = require("../utils/AppError")

/*
 * ADD MONEY TO WALLET
 *   1. POST /api/topup/order   -> we create an order on Razorpay (or mock)
 *   2. browser opens Razorpay checkout, user pays with UPI / card
 *   3. POST /api/topup/verify  -> we check the signature, then credit the wallet
 *   4. POST /api/topup/webhook -> Razorpay tells us directly (backup if the browser closed)
 * Steps 3 and 4 can both happen: crediting is idempotent so the money is added once.
 */

async function creditOrder(order, gatewayPaymentId) {
    if (order.status === "PAID") return order
    const system = await getSystemAccount()
    const { transaction } = await transfer({
        fromAccountId: system._id,
        toAccountId: order.account,
        amount: order.amount,
        idempotencyKey: `topup:${order._id}`,
        kind: "TOPUP",
        note: "Added money via " + (order.gateway === "MOCK" ? "test gateway" : "Razorpay"),
        initiatedBy: order.user,
        allowNegative: true,
        inTransaction: async (session, txn) => {
            await paymentOrderModel.updateOne(
                { _id: order._id },
                { status: "PAID", gatewayPaymentId, transaction: txn._id },
                { session }
            )
        }
    })
    order.status = "PAID"
    order.transaction = transaction._id
    return order
}

/* POST /api/topup/order  { accountId, amount } */
async function createTopupOrder(req, res) {
    const amount = parseAmount(req.body.amount)
    const account = await accountModel.findOne({ _id: req.body.accountId, user: req.user._id })
    if (!account) throw new AppError(404, "Account not found")

    const g = await gateway.createOrder({ amount, receipt: `topup_${account._id}_${Date.now()}`.slice(0, 40) })
    const order = await paymentOrderModel.create({
        user: req.user._id,
        account: account._id,
        amount,
        gateway: g.gateway,
        gatewayOrderId: g.gatewayOrderId
    })

    res.status(201).json({
        mode: g.gateway,
        orderId: g.gatewayOrderId,
        amount,
        amountInPaise: Math.round(amount * 100),
        currency: "INR",
        keyId: g.keyId,   // public key, safe to send to the browser
        name: req.user.name,
        email: req.user.email,
        internalOrderId: order._id
    })
}

/* POST /api/topup/verify  { orderId, paymentId, signature }  (mock mode: { orderId, mock: true }) */
async function verifyTopup(req, res) {
    const { orderId, paymentId, signature, mock } = req.body
    const order = await paymentOrderModel.findOne({ gatewayOrderId: orderId, user: req.user._id })
    if (!order) throw new AppError(404, "Order not found")

    if (order.gateway === "MOCK") {
        if (!mock || !gateway.mockAllowed()) throw new AppError(400, "Mock payments are disabled")
        await creditOrder(order, "mock_pay_" + Date.now())
    } else {
        if (!gateway.verifyCheckoutSignature({ orderId, paymentId, signature })) {
            await paymentOrderModel.updateOne({ _id: order._id, status: "CREATED" }, { status: "FAILED" })
            throw new AppError(400, "Payment verification failed")
        }
        await creditOrder(order, paymentId)
    }

    res.status(200).json({ message: `₹${order.amount} added to your account`, order })
}

/*
 * POST /api/topup/webhook   (called by Razorpay, NOT by our frontend)
 * Set it up in Razorpay Dashboard -> Webhooks -> events: payment.captured, order.paid
 */
async function razorpayWebhook(req, res) {
    const signature = req.headers["x-razorpay-signature"]
    const raw = req.body // Buffer, because this route uses express.raw()
    if (!gateway.verifyWebhookSignature(raw, signature)) {
        return res.status(400).json({ message: "Invalid signature" })
    }
    const event = JSON.parse(raw.toString("utf8"))
    const payment = event.payload?.payment?.entity
    if (["payment.captured", "order.paid"].includes(event.event) && payment?.order_id) {
        const order = await paymentOrderModel.findOne({ gatewayOrderId: payment.order_id })
        if (order) await creditOrder(order, payment.id)
    }
    // always 200 quickly, otherwise Razorpay keeps retrying
    res.status(200).json({ ok: true })
}

/* GET /api/topup/config -> tells the frontend which mode we are in */
function topupConfig(req, res) {
    res.json({ mode: gateway.mode(), mockAllowed: gateway.mockAllowed() })
}

module.exports = { createTopupOrder, verifyTopup, razorpayWebhook, topupConfig }
