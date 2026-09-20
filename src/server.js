require("dotenv").config()   // process env mongo uri will fail agar nahi likhuga 

const app =require("./app")
const ConnectToDB=require("./config/db")

ConnectToDB()

app.listen(3000,()=>{

    console.log("server is runnning on port 3000")
})