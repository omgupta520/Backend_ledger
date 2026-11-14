const path = require("path")
const fs = require("fs")
const express= require("express")
const cookieParser =require("cookie-parser")

// Routes required

const authRouter=require("./routes/auth.routes")
const accontRouter=require("./routes/account.routes")
const transactionRoutes=require("./routes/transaction.routes")
const paymentRoutes=require("./routes/payment.routes")
const topupRoutes=require("./routes/topup.routes")
const merchantRoutes=require("./routes/merchant.routes")
const publicApiRoutes=require("./routes/publicApi.routes")
const topupController=require("./controllers/topup.controller")
const errorMiddleware=require("./middleware/error.middleware")

const app =express()

// Razorpay webhook must see the exact raw bytes to check the signature, so it comes BEFORE express.json()
app.post("/api/topup/webhook", express.raw({ type: "application/json" }), topupController.razorpayWebhook)

app.use(express.json({ limit: "100kb" }))
app.use(cookieParser())

// Routed USED  ---->for deployment server check
app.get("/api/health",(req,res)=>{
    res.send("Ledger Service is up and running")
})

app.use("/api/auth",authRouter)
app.use("/api/accounts",accontRouter)
app.use("/api/transactions",transactionRoutes)
app.use("/api/payments",paymentRoutes)
app.use("/api/topup",topupRoutes)
app.use("/api/merchant",merchantRoutes)
app.use("/api/v1",publicApiRoutes)

app.use("/api",(req,res)=>res.status(404).json({ message:"API route not found" }))

// in production the React build (client/dist) is served by this same server
const clientDist = path.join(__dirname, "..", "client", "dist")
if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist))
    app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(clientDist, "index.html")))
} else {
    app.get("/",(req,res)=>{
        res.send("Ledger Service is up and running")
    })
}

app.use(errorMiddleware)

module.exports=app
