const transactionModel = require("../models/transaction.model")
const ledgerModel =require("../models/ledger.model")
const accountModel =require("../models/account.model") 
const emailService= require("../services/email.service")
const mongoose =require("mongoose")
/**
 * Create a new transaction
 * THE 10-STEP TRANSFER FLOW:
 * 1. Validate request
 * 2. Validate idempotency key
 * 3. Check account status
 * 4. Derive sender balance from ledger
 * 5. Create transaction (PENDING)
 * 6. Create DEBIT ledger entry
 * 7. Create CREDIT ledger entry
 * 8. Mark transaction COMPLETED
 * 9. Commit MongoDB session
 * 10. Send email notification
 */

async function createTransaction(req,res){
    const {fromAccount,toAccount,amount,idempotencyKey}=req.body

    /* Validate request
    */ 

    if(!fromAccount || !toAccount || !amount || !idempotencyKey){
     return    res.status(400).json({
            message:"FromAccount , toAccount ,amount and idempotency are required"
        })
    }

    const fromUserAccount= await accountModel.findOne({
         _id: fromAccount,
    })
    const toUserAccount = await accountModel.findOne({ 
        _id: toAccount
    })
    if(!fromUserAccount || !toUserAccount){
        return res.status(400).json({
            message:"Invalid fromAccount or toAccount "
        })
    }

    /*Validate Idempotency Key
    */ 
   const isTransactionAlreadyExists = await transactionModel.findOne({
    idempotencyKey: idempotencyKey
   })

   if(isTransactionAlreadyExists){
     if(isTransactionAlreadyExists.status === "COMPLETED"){
      return  res.status(200).json({
            message:"Transaction already processed",
            transaction:isTransactionAlreadyExists
        })
     }
     if(isTransactionAlreadyExists.status === "PENDING"){
       return   res.status(200).json({
            message:"Transaction is still processing", 
         })
     }

     if(isTransactionAlreadyExists.status ==="FAILED"){
       return res.status(500).json({
            message:"Transaction processing failed ,please retry"
        })
     }

     if(isTransactionAlreadyExists.status === "REVERSED"){
        return  res.status(500).json({
            message:"Transaction was reversed , please retry"
         })
     }
    
   }

/*Check  account Status
*/    

if(fromUserAccount.status !== "ACTIVE"  || toUserAccount.status !== "ACTIVE"){
    return res.status(400).json({
        message:"Both from Account and To Accout must be ACTIVE to process transaction"
    })
}

/*Derive sender balance form Ledger
*/ 
const balance = await fromUserAccount.getBalance()

if(balance <amount){
   return   res.status(400).json({
        message:`Insufficient balance. Current balance is ${balance}. Requested amount is ${amount}`
     })
}
/** 
 * Create transaction pending
*/
 let transaction;

 const session = await mongoose.startSession()

 try {
    session.startTransaction()

    // create() only honours the session when documents are passed as an array
    transaction = (await transactionModel.create([{
        fromAccount,
        toAccount,
        amount,
        idempotencyKey,
        status:"PENDING"
    }],{session}))[0]

    await ledgerModel.create([{
        account:fromAccount,
        amount:amount,
        transaction:transaction._id,
        type:"DEBIT"
    }],{session})

    await ledgerModel.create([{
        account:toAccount,
        amount:amount,
        transaction:transaction._id,
        type:"CREDIT"
    }],{session})

    // ledger docs are immutable, so the status flip has to go through the transaction doc
    await transactionModel.findOneAndUpdate(
        {_id:transaction._id},
        {status:"COMPLETED"},
        {session}
    )

    await session.commitTransaction()
    transaction.status = "COMPLETED"
 } catch (err) {
    await session.abortTransaction()

    return res.status(400).json({
        message:"Transaction is pending due to some issue, please retry after sometime"
    })
 } finally {
    session.endSession()
 }


    /*Send email Notifiaction
    */

    await emailService.sendTransactionEmail(
        req.user.email,req.user.name,amount ,toAccount
    )

    return res.status (201).json({
        message:"Transaction completed successfully",
        transaction:transaction
    })



}

async function createInitialFundsTransaction(req,res){
    const{toAccount,amount,idempotencyKey}=req.body

    if(!toAccount || !amount || !idempotencyKey){
        return res.status(400).json({
            message:"toAccount,amount and idempotencyKey are required"
        })
    }
    const toUserAccount = await accountModel.findOne({
        _id: toAccount,  
    })
    if(!toUserAccount){
        return res.status(400).json({
            message:"Invalid toAccount"
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

    let transaction;

    const session= await mongoose.startSession()

    try {
        session.startTransaction()

        transaction = (await transactionModel.create([{
            fromAccount:fromUserAccount._id,
            toAccount,
            amount,
            idempotencyKey,
            status:"PENDING"
        }], { session }))[0]

        await ledgerModel.create([{
            account: fromUserAccount._id,
            amount: amount,
            transaction: transaction._id,
            type: "DEBIT"
        }], { session });

        await ledgerModel.create([{
            account: toAccount,
            amount: amount,
            transaction: transaction._id,
            type: "CREDIT"
        }], { session })

        await transactionModel.findOneAndUpdate(
            {_id:transaction._id},
            {status:"COMPLETED"},
            {session}
        )

        await session.commitTransaction()
        transaction.status = "COMPLETED"
    } catch (err) {
        await session.abortTransaction()

        return res.status(400).json({
            message:"Initial funds transaction failed, please retry after sometime"
        })
    } finally {
        session.endSession()
    }

    return res.status(201).json({
        message:"Initial funds transaction completed successfully ",
        transaction: transaction
    })
}
module.exports={createTransaction,createInitialFundsTransaction}