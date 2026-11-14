const mongoose =require("mongoose")
const ledgerModel =require("./ledger.model")

/*
 * An account is like a bank account / wallet inside our app.
 * Every account gets:
 *   - accountNumber : 12 digit number            e.g. 501234567890
 *   - ifsc          : our "bank" branch code      e.g. LDGR0001001
 *   - upiId         : easy-to-share handle       e.g. rahul4821@ledger
 * The balance is NOT stored here. It is always derived from the ledger (credits - debits).
 */
const accountSchema =new mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"user",
        required:[true,"Account must be associated with a user"],
        index:true
    },
    type:{
        type:String,
        enum:{
            values:["PERSONAL","MERCHANT","SYSTEM"],
            message:"Type can be PERSONAL, MERCHANT or SYSTEM"
        },
        default:"PERSONAL"
    },
    // shown to the payer instead of the person's name for merchant accounts
    businessName:{
        type:String,
        trim:true
    },
    accountNumber:{
        type:String,
        unique:true,
        sparse:true
    },
    ifsc:{
        type:String,
        default:"LDGR0001001"
    },
    upiId:{
        type:String,
        lowercase:true,
        trim:true,
        unique:true,
        sparse:true
    },
    status:{
        type:String,
        enum:{
            values:["ACTIVE","FROZEN","CLOSED"],
            message:"Status can be either ACTIVE,FROZEN or CLOSED",

        },
        default:"ACTIVE"
    },
    currency:{
        type:String,
        required:[true,"Currency is required for creating an account "],
        default :"INR"
    },
    // bumped inside every debit. Two payments from the same account at the same
    // moment both try to write this field, so MongoDB lets only one commit first
    // and retries the other -> no double spending.
    lockVersion:{
        type:Number,
        default:0
    }
},{
    timestamps:true

})

accountSchema.index( {user:1,status:1})
accountSchema.methods.getBalance = async function(session){
    const pipeline = ledgerModel.aggregate([
        {$match:{account : this._id }},
        {
            $group:{
                _id:null,
                totalDebit:{
                    $sum:{
                        $cond:[
                            {$eq:["$type","DEBIT"]},
                            "$amount",
                            0
                        ]
                    }
                },
                totalCredit:{
                    $sum:{
                        $cond:[
                            {$eq:["$type","CREDIT"]},
                            "$amount",
                            0
                        ]
                    }
                }
            }
        },
        {
            $project:{
                _id:0,
                balance:{$subtract :["$totalCredit","$totalDebit"]}
            }
        }
    ])
    if(session){
        pipeline.session(session)
    }
    const balanceData = await pipeline

    if(balanceData.length === 0 ){
        return 0
    }
    // avoid 0.30000000000000004 style float noise
    return Math.round(balanceData[0].balance * 100) / 100
}

const accountModel =mongoose.model("account",accountSchema)

module.exports=accountModel
