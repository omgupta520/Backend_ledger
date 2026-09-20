const express =require("express")
const authMiddleware = require("../middleware/auth.middleware")
const accountController= require("../controllers/account.controller")


const router =express.Router()


// POST - /api/accounts/
//* create a new account 
//* protected route 

router.post("/",authMiddleware.authMiddleware,accountController.createAccountController)


/* Get all account of logged in user
*/ 

router.get("/",authMiddleware.authMiddleware,accountController.getUserAccountsController)


/* GET /api/accounts/balance/:accountId
*  Get derived balance of one of the logged in user's accounts
*/

router.get("/balance/:accountId",authMiddleware.authMiddleware,accountController.getAccountBalanceController)



module.exports =router