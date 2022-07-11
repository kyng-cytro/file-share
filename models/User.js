const mongoose = require('mongoose')

const User = new mongoose.Schema({
    ip: {
        type: String,
        required: true
    },
    fileName: {
        type: String,
        required: true
    },     
    createdAt: {
        type: Date,
        required: true,
    }, 
})

module.exports =  mongoose.model("User", User)