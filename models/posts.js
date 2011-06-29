var mongoose = require('mongoose'),
Schema = mongoose.Schema,
ObjectId = Schema.ObjectId;

var postsSchema = new Schema({
    _id: ObjectId,
    user : { type: String },
    title : { type: String },
    story : { type: String },
    createdDate : { type: Date, default: Date.now }
});

var posts =  mongoose.model('posts', postsSchema);