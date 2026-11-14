const crypto = require("crypto")
const mongoose = require("mongoose")
const accountModel = require("../models/account.model")
const ledgerModel = require("../models/ledger.model")
const transactionModel = require("../models/transaction.model")
const userModel = require("../models/user.model")
const AppError = require("../utils/AppError")
const { parseAmount } = require("../utils/money")

// 12 digit receipt number, looks like a UPI reference number
const newReferenceId = () => String(Date.now()).slice(-6) + String(crypto.randomInt(0, 1e6)).padStart(6, "0")

/*
 * THE ONE PLACE WHERE MONEY MOVES.
 * Every feature (send money, pay merchant, add money, initial funds) calls this.
 *
 * Inside ONE MongoDB transaction (all-or-nothing):
 *   1. lock the sender account (bump lockVersion)
 *   2. check both accounts are ACTIVE
 *   3. check sender balance from the ledger
 *   4. create the transaction record
 *   5. write DEBIT entry for sender + CREDIT entry for receiver
 *   6. run the extra step (e.g. mark a payment request PAID)
 * If anything fails, nothing is saved. Same idempotencyKey twice = processed only once.
 */
async function transfer({
    fromAccountId,
    toAccountId,
    amount,
    idempotencyKey,
    kind = "TRANSFER",
    note,
    initiatedBy,
    paymentRequestId,
    allowNegative = false,   // only the SYSTEM account may go below zero (it represents money coming from outside)
    inTransaction            // optional async (session, transaction) => {} that must succeed together with the transfer
}) {
    amount = parseAmount(amount, { max: allowNegative ? 10000000 : undefined })

    if (!idempotencyKey) throw new AppError(400, "idempotencyKey is required")
    if (!fromAccountId || !toAccountId) throw new AppError(400, "Both accounts are required")
    if (String(fromAccountId) === String(toAccountId)) throw new AppError(400, "You cannot pay the same account")

    const existing = await transactionModel.findOne({ idempotencyKey })
    if (existing) return { transaction: existing, duplicate: true }

    const session = await mongoose.startSession()
    let transaction
    try {
        // withTransaction automatically retries on write conflicts (two payments at the same time)
        await session.withTransaction(async () => {
            const from = await accountModel.findOneAndUpdate(
                { _id: fromAccountId },
                { $inc: { lockVersion: 1 } },
                { new: true, session }
            )
            const to = await accountModel.findById(toAccountId).session(session)

            if (!from || !to) throw new AppError(404, "Account not found")
            if (from.status !== "ACTIVE" || to.status !== "ACTIVE") {
                throw new AppError(400, "Both accounts must be ACTIVE to process the payment")
            }

            if (!allowNegative) {
                const balance = await from.getBalance(session)
                if (balance < amount) {
                    throw new AppError(400, `Insufficient balance. Available ₹${balance}, needed ₹${amount}`)
                }
            }

            // created straight as COMPLETED: nobody can see it until the whole transaction commits
            transaction = (await transactionModel.create([{
                fromAccount: from._id,
                toAccount: to._id,
                amount,
                kind,
                note,
                initiatedBy,
                paymentRequest: paymentRequestId,
                referenceId: newReferenceId(),
                idempotencyKey,
                status: "COMPLETED"
            }], { session }))[0]

            await ledgerModel.create([
                { account: from._id, amount, transaction: transaction._id, type: "DEBIT" },
                { account: to._id, amount, transaction: transaction._id, type: "CREDIT" }
            ], { session, ordered: true })

            if (inTransaction) await inTransaction(session, transaction)
        })
    } catch (err) {
        // the same key was used by a request running at the same moment -> return that one
        if (err && err.code === 11000 && err.keyPattern && err.keyPattern.idempotencyKey) {
            const already = await transactionModel.findOne({ idempotencyKey })
            if (already) return { transaction: already, duplicate: true }
        }
        throw err
    } finally {
        await session.endSession()
    }

    return { transaction, duplicate: false }
}

// the account that "creates" money when it enters from a bank / Razorpay
async function getSystemAccount() {
    const systemUser = await userModel.findOne({ systemUser: true })
    const account = systemUser && await accountModel.findOne({ user: systemUser._id })
    if (!account) {
        throw new AppError(500, "System account missing. Run: npm run seed:system")
    }
    return account
}

module.exports = { transfer, getSystemAccount }
