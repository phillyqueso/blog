var mongoose = require('mongoose'),
Schema = mongoose.Schema,
ObjectId = Schema.ObjectId;

var commentsSchema = new Schema({
    user : { type: String },
    comment : { type: String },
    createdDate : { type: Date, default: Date.now }
});

var postsSchema = new Schema({
    _id: ObjectId,
    user : { type: String },
    title : { type: String },
    story : { type: String },
    createdDate : { type: Date, default: Date.now },
    comments: [commentsSchema]
});

var posts =  mongoose.model('posts', postsSchema);