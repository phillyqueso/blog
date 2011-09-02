var mongoose = require('mongoose'),
Schema = mongoose.Schema;

var commentsSchema = new Schema({
    user : { type: String },
    comment : { type: String },
    createdDate : { type: Date, default: Date.now }
});

var postsSchema = new Schema({
    user : { type: String },
    title : { type: String },
    story : { type: String },
    canComment: { type: Boolean },
    createdDate : { type: Date, default: Date.now },
    comments: [commentsSchema]
});

var posts =  mongoose.model('posts', postsSchema);