const mongoose =require("mongoose")


function ConnectToDB(){

    mongoose.connect(process.env.MONGO_URI)
    .then(()=>{
        console.log("server is connected to DB")
    })
    .catch(err=>{
        console.log("Error Connecting to DB")
        process.exit(1) // server ko band kar do agar db se nahi connectv hua 
    })
}

module.exports =ConnectToDB
