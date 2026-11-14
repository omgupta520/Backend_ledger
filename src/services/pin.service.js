const bcrypt = require("bcryptjs")
const userModel = require("../models/user.model")
const AppError = require("../utils/AppError")

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

function validatePinFormat(pin) {
    if (!/^\d{4}$|^\d{6}$/.test(String(pin || ""))) {
        throw new AppError(400, "PIN must be 4 or 6 digits")
    }
}

async function setPin(userId, pin) {
    validatePinFormat(pin)
    const pinHash = await bcrypt.hash(String(pin), 10)
    await userModel.updateOne({ _id: userId }, { pinHash, pinAttempts: 0, pinLockedUntil: null })
}

async function hasPin(userId) {
    const user = await userModel.findById(userId).select("+pinHash")
    return Boolean(user && user.pinHash)
}

/*
 * Checks the payment PIN. 5 wrong tries -> PIN locked for 15 minutes.
 */
async function verifyPin(userId, pin) {
    const user = await userModel.findById(userId).select("+pinHash +pinAttempts +pinLockedUntil")
    if (!user || !user.pinHash) {
        throw new AppError(400, "Set your payment PIN first")
    }
    if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
        throw new AppError(423, "Too many wrong PIN attempts. Try again later")
    }
    const ok = await bcrypt.compare(String(pin || ""), user.pinHash)
    if (!ok) {
        const attempts = (user.pinAttempts || 0) + 1
        const update = { pinAttempts: attempts }
        if (attempts >= MAX_ATTEMPTS) {
            update.pinAttempts = 0
            update.pinLockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
        }
        await userModel.updateOne({ _id: userId }, update)
        throw new AppError(401, attempts >= MAX_ATTEMPTS
            ? `Wrong PIN. PIN locked for ${LOCK_MINUTES} minutes`
            : `Wrong PIN. ${MAX_ATTEMPTS - attempts} attempts left`)
    }
    if (user.pinAttempts) {
        await userModel.updateOne({ _id: userId }, { pinAttempts: 0, pinLockedUntil: null })
    }
}

module.exports = { setPin, hasPin, verifyPin }
