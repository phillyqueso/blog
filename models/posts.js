var mongoose = require('mongoose'),
Schema = mongoose.Schema,
ObjectId = Schema.ObjectId;

var postsSchema = new Schema({
    postId: ObjectId,
    username : { type: String, required: true },
    title : { type: String, required: true },
    story : { type: String, required: true },
    createdDate : { type: Date, default: Date.now }
});

var posts =  mongoose.model('posts', postsSchema);