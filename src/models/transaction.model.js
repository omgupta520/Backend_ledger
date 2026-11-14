const mongoose =require("mongoose")


const transactionSchema= new mongoose.Schema({

    fromAccount:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"account",
        required:[true,"Transaction must be associated with a from account "],
        index:true
    },
    toAccount:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"account",
        required:[true,"Transaction must be associated with a to account "],
        index:true
    },
    status:{
        type:String,
        enum:{
            values:["PENDING","COMPLETED","FAILED","REVERSED"],
            message:"Status can be either PENDING,COMPLETED,FAILED or REVERSED",
        },
        default:"PENDING"
    },
    // what kind of money movement this was (used for the history screen)
    kind:{
        type:String,
        enum:["TRANSFER","MERCHANT_PAYMENT","TOPUP","INITIAL_FUNDS"],
        default:"TRANSFER"
    },
    amount:{
        type:Number,
        required:[true,"Amount is required for creating a transaction"],
        min:[0,"Transaction amount cannot be negative "]
    },
    note:{
        type:String,
        trim:true,
        maxlength:100
    },
    // set when the payment settled a merchant payment request
    paymentRequest:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"paymentRequest"
    },
    // user who pressed "pay"
    initiatedBy:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"user"
    },
    // a public-looking reference number shown on receipts, like a UTR / UPI ref no.
    referenceId:{
        type:String,
        index:true
    },
    idempotencyKey: {
    type: String,
    required: [true, "Idempotency Key is required for creating a transaction"],
    index: true,
    unique: true
}
}, {
    timestamps: true

});

const transactionModel= mongoose.model("transaction",transactionSchema)

module.exports = transactionModel
