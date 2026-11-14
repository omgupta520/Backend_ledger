const accountModel = require("../models/account.model")
const ledgerModel = require("../models/ledger.model")
const { transfer } = require("../services/ledger.service")
const { maskAccountNumber } = require("../services/identifier.service")
const AppError = require("../utils/AppError")

/*
 * POST /api/transactions   { fromAccount, toAccount, amount, idempotencyKey }
 * Old raw API that pays by internal account _id. Kept for the Postman collection.
 * The website uses /api/payments/send (pay by UPI id / account number + PIN) instead.
 */
async function createTransaction(req,res){
    const {fromAccount,toAccount,amount,idempotencyKey}=req.body

    if(!fromAccount || !toAccount || !amount || !idempotencyKey){
     return    res.status(400).json({
            message:"FromAccount , toAccount ,amount and idempotency are required"
        })
    }

    // you can only spend from YOUR OWN account
    const owns = await accountModel.exists({ _id: fromAccount, user: req.user._id })
    if (!owns) throw new AppError(403, "fromAccount does not belong to you")

    const { transaction, duplicate } = await transfer({
        fromAccountId: fromAccount,
        toAccountId: toAccount,
        amount,
        idempotencyKey,
        initiatedBy: req.user._id
    })

    return res.status(duplicate ? 200 : 201).json({
        message: duplicate ? "Transaction already processed" : "Transaction completed successfully",
        transaction
    })
}

/* POST /api/transactions/system/initial-funds  (system user only) */
async function createInitialFundsTransaction(req,res){
    const{toAccount,amount,idempotencyKey}=req.body

    if(!toAccount || !amount || !idempotencyKey){
        return res.status(400).json({
            message:"toAccount,amount and idempotencyKey are required"
        })
    }
    const fromUserAccount =await accountModel.findOne({
        user:req.user._id
    })
    if(!fromUserAccount){
        return res.status(400).json({
            message:"System user account not found "
        })
    }

    const { transaction, duplicate } = await transfer({
        fromAccountId: fromUserAccount._id,
        toAccountId: toAccount,
        amount,
        idempotencyKey,
        kind: "INITIAL_FUNDS",
        initiatedBy: req.user._id,
        allowNegative: true
    })

    return res.status(duplicate ? 200 : 201).json({
        message:"Initial funds transaction completed successfully ",
        transaction: transaction
    })
}

// how the other side of a payment is shown in history
function partyView(account) {
    if (!account) return null
    return {
        name: account.type === "SYSTEM" || account.user?.systemUser
            ? "Added to wallet"
            : (account.businessName || account.user?.name || "Unknown"),
        upiId: account.upiId,
        accountNumber: maskAccountNumber(account.accountNumber),
        type: account.type
    }
}

/*
 * GET /api/transactions?accountId=...&limit=50
 * Statement for the logged in user's accounts, newest first.
 */
async function getHistory(req,res){
    const filter = { user: req.user._id }
    if (req.query.accountId) filter._id = req.query.accountId
    const myAccounts = await accountModel.find(filter).select("_id")
    const ids = myAccounts.map(a => a._id)

    const limit = Math.min(Number(req.query.limit) || 50, 200)

    const populateParty = { path: "user", select: "name +systemUser" }
    const entries = await ledgerModel.find({ account: { $in: ids } })
        .sort({ _id: -1 })
        .limit(limit)
        .populate({
            path: "transaction",
            populate: [
                { path: "fromAccount", populate: populateParty },
                { path: "toAccount", populate: populateParty }
            ]
        })

    const items = entries.filter(e => e.transaction).map(e => {
        const t = e.transaction
        const isDebit = e.type === "DEBIT"
        return {
            _id: e._id,
            direction: isDebit ? "SENT" : "RECEIVED",
            amount: e.amount,
            account: e.account,
            counterparty: partyView(isDebit ? t.toAccount : t.fromAccount),
            kind: t.kind,
            note: t.note,
            status: t.status,
            referenceId: t.referenceId,
            transactionId: t._id,
            createdAt: t.createdAt
        }
    })

    res.status(200).json({ items })
}

module.exports={createTransaction,createInitialFundsTransaction,getHistory}
