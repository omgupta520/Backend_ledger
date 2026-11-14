const accountModel = require("../models/account.model");
const { ensureIdentifiers, createAccountForUser } = require("../services/identifier.service");
const AppError = require("../utils/AppError");

// what the frontend gets for one account (balance included)
async function toAccountView(account, ownerName) {
    await ensureIdentifiers(account, ownerName)
    return {
        _id: account._id,
        type: account.type,
        businessName: account.businessName,
        accountNumber: account.accountNumber,
        ifsc: account.ifsc,
        upiId: account.upiId,
        status: account.status,
        currency: account.currency,
        balance: await account.getBalance(),
        createdAt: account.createdAt
    }
}

/* POST /api/accounts   { type?: "PERSONAL" | "MERCHANT", businessName? } */
async function createAccountController (req,res){
    const { type = "PERSONAL", businessName } = req.body || {}

    if (!["PERSONAL", "MERCHANT"].includes(type)) {
        throw new AppError(400, "type must be PERSONAL or MERCHANT")
    }
    if (type === "MERCHANT" && !String(businessName || "").trim()) {
        throw new AppError(400, "businessName is required for a merchant account")
    }

    const account = await createAccountForUser(req.user, {
        type,
        businessName: type === "MERCHANT" ? String(businessName).trim() : undefined
    })
    res.status(201).json({
        account: await toAccountView(account, req.user.name)
    })
}

/* GET /api/accounts */
async function getUserAccountsController(req,res){
    const accounts = await accountModel.find({user:req.user._id}).sort({ createdAt: 1 });
    res.status(200).json({
        accounts: await Promise.all(accounts.map(a => toAccountView(a, req.user.name)))
    })

}

/* GET /api/accounts/balance/:accountId */
async function getAccountBalanceController(req,res){
    const {accountId} = req.params;

    const account = await accountModel.findOne({
        _id:accountId,
        user:req.user._id
    })

    if(!account){
        return res.status(404).json({
            message:"Account not found"
        })
    }

    const balance = await account.getBalance();

    res.status(200).json({
        accountId:account._id,
        balance:balance
    })
}

module.exports={
    createAccountController,
    getUserAccountsController,
    getAccountBalanceController,
    toAccountView
}
