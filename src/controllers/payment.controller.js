const accountModel = require("../models/account.model")
const paymentRequestModel = require("../models/paymentRequest.model")
const { transfer } = require("../services/ledger.service")
const { verifyPin } = require("../services/pin.service")
const { maskAccountNumber } = require("../services/identifier.service")
const emailService = require("../services/email.service")
const AppError = require("../utils/AppError")

/*
 * Find an account from what the user typed:
 *   "rahul4821@ledger"  -> by UPI id
 *   "501234567890"      -> by account number (ifsc optional, checked if given)
 */
async function findPayee(to, ifsc) {
    const value = String(to || "").trim().toLowerCase()
    if (!value) throw new AppError(400, "Enter a UPI ID or account number")

    let query
    if (value.includes("@")) query = { upiId: value }
    else if (/^\d{9,18}$/.test(value)) query = { accountNumber: value }
    else throw new AppError(400, "That is not a valid UPI ID or account number")

    const account = await accountModel.findOne(query).populate({ path: "user", select: "name email +systemUser" })
    if (!account || account.type === "SYSTEM" || account.user?.systemUser) {
        throw new AppError(404, "No account found for this UPI ID / account number")
    }
    if (ifsc && String(ifsc).toUpperCase() !== account.ifsc) {
        throw new AppError(400, "IFSC does not match this account number")
    }
    if (account.status !== "ACTIVE") throw new AppError(400, "This account cannot receive money right now")
    return account
}

const payeeView = (account) => ({
    accountId: account._id,
    name: account.businessName || account.user.name,
    isMerchant: account.type === "MERCHANT",
    upiId: account.upiId,
    accountNumber: maskAccountNumber(account.accountNumber),
    ifsc: account.ifsc
})

async function getOwnAccount(userId, accountId) {
    const account = accountId
        ? await accountModel.findOne({ _id: accountId, user: userId })
        : await accountModel.findOne({ user: userId, type: "PERSONAL", status: "ACTIVE" }).sort({ createdAt: 1 })
    if (!account) throw new AppError(404, "Choose one of your accounts to pay from")
    return account
}

/* POST /api/payments/resolve  { to, ifsc? }  -> shows "Paying Rahul Sharma" before you pay */
async function resolvePayee(req, res) {
    const account = await findPayee(req.body.to, req.body.ifsc)
    res.status(200).json({ payee: payeeView(account) })
}

/*
 * POST /api/payments/send
 * { fromAccountId, to, ifsc?, amount, note?, pin, idempotencyKey }
 */
async function sendMoney(req, res) {
    const { fromAccountId, to, ifsc, amount, note, pin, idempotencyKey } = req.body

    const from = await getOwnAccount(req.user._id, fromAccountId)
    const payee = await findPayee(to, ifsc)
    await verifyPin(req.user._id, pin)

    const { transaction, duplicate } = await transfer({
        fromAccountId: from._id,
        toAccountId: payee._id,
        amount,
        idempotencyKey,
        kind: payee.type === "MERCHANT" ? "MERCHANT_PAYMENT" : "TRANSFER",
        note,
        initiatedBy: req.user._id
    })

    if (!duplicate) {
        // don't make the user wait for the email
        emailService.sendTransactionEmail(req.user.email, req.user.name, transaction.amount, payeeView(payee).name)
            .catch(() => {})
    }

    res.status(duplicate ? 200 : 201).json({
        message: duplicate ? "Payment already processed" : "Payment successful",
        payment: receipt(transaction, payeeView(payee))
    })
}

const receipt = (transaction, payee) => ({
    transactionId: transaction._id,
    referenceId: transaction.referenceId,
    amount: transaction.amount,
    note: transaction.note,
    status: transaction.status,
    paidTo: payee,
    createdAt: transaction.createdAt
})

/* GET /api/payments/requests/:id   (public: so a payment link can be opened before login) */
async function getPaymentRequest(req, res) {
    const request = await paymentRequestModel.findById(req.params.id)
        .populate({ path: "merchantAccount", populate: { path: "user", select: "name" } })
    if (!request) throw new AppError(404, "Payment request not found")

    const expired = request.status === "PENDING" && request.expiresAt < new Date()
    res.status(200).json({
        request: {
            _id: request._id,
            amount: request.amount,
            note: request.note,
            reference: request.reference,
            status: expired ? "EXPIRED" : request.status,
            expiresAt: request.expiresAt,
            paidAt: request.paidAt,
            merchant: {
                name: request.merchantAccount.businessName || request.merchantAccount.user.name,
                upiId: request.merchantAccount.upiId
            }
        }
    })
}

/* POST /api/payments/requests/:id/pay  { fromAccountId, pin } */
async function payPaymentRequest(req, res) {
    const { fromAccountId, pin } = req.body
    const request = await paymentRequestModel.findById(req.params.id).populate("merchantAccount")
    if (!request) throw new AppError(404, "Payment request not found")
    if (request.status !== "PENDING") throw new AppError(409, "This payment request is already " + request.status.toLowerCase())
    if (request.expiresAt < new Date()) throw new AppError(410, "This payment request has expired")

    const from = await getOwnAccount(req.user._id, fromAccountId)
    await verifyPin(req.user._id, pin)

    const { transaction } = await transfer({
        fromAccountId: from._id,
        toAccountId: request.merchantAccount._id,
        amount: request.amount,
        // one request can only ever be paid once, whoever pays it
        idempotencyKey: `payreq:${request._id}`,
        kind: "MERCHANT_PAYMENT",
        note: request.note || request.reference,
        paymentRequestId: request._id,
        initiatedBy: req.user._id,
        // runs inside the same DB transaction: money moves AND the request becomes PAID, or neither
        inTransaction: async (session, txn) => {
            const updated = await paymentRequestModel.findOneAndUpdate(
                { _id: request._id, status: "PENDING" },
                { status: "PAID", paidByAccount: from._id, transaction: txn._id, paidAt: new Date() },
                { session, new: true }
            )
            if (!updated) throw new AppError(409, "This payment request was already paid")
        }
    })

    if (String(transaction.fromAccount) !== String(from._id)) {
        throw new AppError(409, "This payment request was already paid")
    }

    res.status(201).json({
        message: "Payment successful",
        payment: receipt(transaction, {
            accountId: request.merchantAccount._id,
            name: request.merchantAccount.businessName,
            isMerchant: true,
            upiId: request.merchantAccount.upiId
        })
    })
}

module.exports = { resolvePayee, sendMoney, getPaymentRequest, payPaymentRequest, findPayee }
