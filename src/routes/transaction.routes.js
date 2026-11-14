const {Router} =require('express');
const authMiddleware = require('../middleware/auth.middleware')
const transactionRoutes=Router();
const transactionController =require('../controllers/transaction.controller')

/*
*  POST /api/transactions/
* Create a new transactions   
*/ 

transactionRoutes.post("/",authMiddleware.authMiddleware,transactionController.createTransaction)

/* GET /api/transactions?accountId=   statement / history */
transactionRoutes.get("/",authMiddleware.authMiddleware,transactionController.getHistory)

/*post /api /transactions /system /initial-funds
*Create initial fundstransaction from system user
*/ 

transactionRoutes.post("/system/initial-funds",authMiddleware.authSystemUserMiddleware,transactionController.createInitialFundsTransaction )

module.exports= transactionRoutes;