var mongoose = require('mongoose'),
Schema = mongoose.Schema;

var usersSchema = new Schema({
    username : { type: String, required: true },
    password : { type: String, required: true }
});

var users =  mongoose.model('users', usersSchema);
