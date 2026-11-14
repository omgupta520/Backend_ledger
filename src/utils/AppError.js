// An error we throw on purpose. The error middleware turns it into a clean JSON response.
class AppError extends Error {
    constructor(statusCode, message) {
        super(message)
        this.statusCode = statusCode
    }
}

module.exports = AppError
