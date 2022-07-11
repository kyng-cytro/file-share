const mongoose = require('mongoose')


const File = new mongoose.Schema({
    path: {
        type: String,
        required: true,
    },
    originalName: {
        type: String,
        required: true
    },
    fileName: {
        type: String,
        required: true
    },    
    fileType: {
        type: String,
        required: true
    },
    fileSize: {
        type: String,
        required: true
    },
    downloadCount: {
        type: Number,
        required: true,
        default: 0
    },
    createdAt: {
        type: Date,
        required: true,
    },    
    password: String
})


module.exports =  mongoose.model("File", File)