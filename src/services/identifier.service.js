const crypto = require("crypto")
const accountModel = require("../models/account.model")

const UPI_HANDLE = process.env.UPI_HANDLE || "ledger"

const randomDigits = (n) => Array.from({ length: n }, () => crypto.randomInt(0, 10)).join("")

/*
 * 12 digit account number that starts with 5, e.g. 501234567890.
 * Random + unique check (the DB unique index is the final guard).
 */
async function generateAccountNumber() {
    for (let i = 0; i < 10; i++) {
        const candidate = "5" + randomDigits(11)
        if (!(await accountModel.exists({ accountNumber: candidate }))) return candidate
    }
    throw new Error("Could not generate a unique account number")
}

/*
 * UPI style id from the name: "Rahul Sharma" -> rahulsharma4821@ledger
 */
async function generateUpiId(name) {
    const base = (name || "user").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12) || "user"
    for (let i = 0; i < 10; i++) {
        const candidate = `${base}${randomDigits(4)}@${UPI_HANDLE}`
        if (!(await accountModel.exists({ upiId: candidate }))) return candidate
    }
    throw new Error("Could not generate a unique UPI id")
}

// old accounts (created before this feature) don't have numbers yet: fill them in once
async function ensureIdentifiers(account, ownerName) {
    let changed = false
    if (!account.accountNumber) {
        account.accountNumber = await generateAccountNumber()
        changed = true
    }
    if (!account.upiId) {
        account.upiId = await generateUpiId(account.businessName || ownerName)
        changed = true
    }
    if (changed) await account.save()
    return account
}

async function createAccountForUser(user, { type = "PERSONAL", businessName } = {}) {
    return accountModel.create({
        user: user._id,
        type,
        businessName,
        accountNumber: await generateAccountNumber(),
        upiId: await generateUpiId(businessName || user.name)
    })
}

function maskAccountNumber(accountNumber) {
    if (!accountNumber) return null
    return "XXXX" + accountNumber.slice(-4)
}

module.exports = { generateAccountNumber, generateUpiId, ensureIdentifiers, createAccountForUser, maskAccountNumber }
