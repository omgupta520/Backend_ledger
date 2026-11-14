const  userModel=require("../models/user.model")
const jwt =require("jsonwebtoken")
const emailService =require("../services/email.service")
const tokenBlackListModel =require("../models/blackList.model")
const { createAccountForUser } = require("../services/identifier.service")
const pinService = require("../services/pin.service")
const AppError = require("../utils/AppError")

// httpOnly = JavaScript in the browser cannot read the token (protects against XSS stealing it)
const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 3 * 24 * 60 * 60 * 1000
}


/*
user register controller
POST /api/auth/register 
*/ 

async function userRegisterController(req,res){

    const {email,password,name}= req.body

    const isExists =await userModel.findOne({
        email:email
    })
    if(isExists){
        return res.status(422).json({
            message:"User Already exists with email. ",
            status:"failed"
        })
    }

    const user =await userModel.create({
        email,password,name
    })

    // every new user gets a personal account with account number + UPI id right away
    await createAccountForUser(user)

    const token =jwt.sign({ userId:user._id},process.env.JWT_SECRET,{expiresIn:"3d"})
    res.cookie("token",token,cookieOptions)
    res.status(201).json({
        user:{
            _id:user._id,
            email:user.email,
            name :user.name
        },
        token
    })

    await emailService.sendRegistrationEmail(user.email,user.name)

}

/*USER Login controller 
*-POST /api/auth/login
*/

async function userLoginController(req,res){
    const {email,password} =req.body 

    const user= await userModel.findOne({email}).select("+password")

    if(!user){
        return res.status(401).json({
            message:"Email or Password is Invalid"
        })
    }

   const isValidpassword = await  user.comparePassword(password)
   if(!isValidpassword){
      return res.status(401).json({
            message:"Email or Password is Invalid"
        })
   }

   const token =jwt.sign({ userId:user._id},process.env.JWT_SECRET,{expiresIn:"3d"})
    res.cookie("token",token,cookieOptions)
    res.status(200).json({
        user:{
            _id:user._id,
            email:user.email,
            name :user.name
        },
        token
    })
}

/*USER Logout controller
*-POST /api/auth/logout
*/

async function userLogoutController(req,res){
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1]

    if(!token){
        return res.status(200).json({
            message:"User logged out successfully"
        })
    }

    await tokenBlackListModel.create({
        token:token
    })

    res.clearCookie("token",cookieOptions)

    res.status(200).json({
        message:"User logged out successfully"
    })
}

/* Who am I?
*-GET /api/auth/me
*/
async function meController(req,res){
    res.status(200).json({
        user:{
            _id:req.user._id,
            email:req.user.email,
            name:req.user.name,
            hasPin: await pinService.hasPin(req.user._id)
        }
    })
}

/* Set or change payment PIN (needs login password again, like a bank asks for it)
*-POST /api/auth/pin   { password, pin }
*/
async function setPinController(req,res){
    const {password,pin} = req.body
    const user = await userModel.findById(req.user._id).select("+password")
    if(!password || !(await user.comparePassword(password))){
        throw new AppError(401,"Password is incorrect")
    }
    await pinService.setPin(user._id,pin)
    res.status(200).json({ message:"Payment PIN saved" })
}

module.exports={
    userRegisterController,
    userLoginController,
    userLogoutController,
    meController,
    setPinController
}