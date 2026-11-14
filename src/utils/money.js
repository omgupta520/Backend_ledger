const AppError = require("./AppError")

const MAX_PAYMENT = 100000 // ₹1,00,000 per payment, same idea as the UPI limit

/*
 * Accepts "499", 499 or 499.5 and returns a clean rupee number with max 2 decimals.
 * Throws for 0, negatives, NaN, too many decimals or amounts above the limit.
 */
function parseAmount(value, { max = MAX_PAYMENT } = {}) {
    const amount = Number(value)
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new AppError(400, "Amount must be a positive number")
    }
    if (Math.round(amount * 100) !== amount * 100) {
        throw new AppError(400, "Amount can have at most 2 decimal places")
    }
    if (amount > max) {
        throw new AppError(400, `Amount cannot be more than ₹${max}`)
    }
    return amount
}

// razorpay works in paise (1 rupee = 100 paise)
const toPaise = (rupees) => Math.round(rupees * 100)

module.exports = { parseAmount, toPaise, MAX_PAYMENT }
