var mongoose = require('mongoose')
  , Schema = mongoose.Schema;

var postsSchema = new Schema({
    username : { type: String, required: true },
    title : { type: String, required: true },
    story : { type: String, required: true },
    createdDate : { type: Date, default: Date.now }
});

var posts =  mongoose.model('posts', postsSchema);