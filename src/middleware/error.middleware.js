const mongoose = require("mongoose")
const AppError = require("../utils/AppError")

// Express 5 sends errors thrown in async controllers here automatically
// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message })
    }
    if (err instanceof mongoose.Error.ValidationError) {
        const message = Object.values(err.errors).map(e => e.message).join(", ")
        return res.status(400).json({ message })
    }
    if (err instanceof mongoose.Error.CastError) {
        return res.status(400).json({ message: `Invalid ${err.path}` })
    }
    if (err && err.type === "entity.parse.failed") {
        return res.status(400).json({ message: "Invalid JSON body" })
    }
    console.error(err)
    res.status(500).json({ message: "Something went wrong, please try again" })
}

module.exports = errorMiddleware
