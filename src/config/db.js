const mongoose =require("mongoose")


function ConnectToDB(){

    if(!process.env.MONGO_URI){
        console.error("MONGO_URI is not set. On Render, add it under Settings -> Environment.")
        process.exit(1)
    }

    mongoose.connect(process.env.MONGO_URI)
    .then(()=>{
        console.log("server is connected to DB")
    })
    .catch(err=>{
        // print the real reason, otherwise deploy logs say nothing useful
        console.error("Error Connecting to DB:", err.message)
        process.exit(1) // server ko band kar do agar db se nahi connectv hua 
    })
}

module.exports =ConnectToDB
