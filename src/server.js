require("dotenv").config()   // process env mongo uri will fail agar nahi likhuga 

const app =require("./app")
const ConnectToDB=require("./config/db")

ConnectToDB()

// Render (and most hosts) assign the port at runtime via $PORT
const PORT = process.env.PORT || 3000

app.listen(PORT,()=>{

    console.log(`server is runnning on port ${PORT}`)
})
