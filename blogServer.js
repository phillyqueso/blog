const express = require('express'),
app = express.createServer(),
io = require('socket.io'),
mongoose = require('mongoose'),
db = mongoose.connect('mongodb://localhost/blog');

var users = require(__dirname + '/models/users.js');
var posts = require(__dirname + '/models/posts.js');

var Users = mongoose.model('users');
var Posts = mongoose.model('posts');

/*
var story1 = {title: "A node.js day", story: "cool stuff going on in node.js.", user: "bloguser"};
var onePost = new Posts(story1);
onePost.save(function(err) {
    console.log(err);
});
*/

app.configure(function() {
    app.use(express.static(__dirname + '/public'));
    app.use(express.errorHandler());
    app.use(express.logger());
});

app.listen(8080);

var socket = io.listen(app);
socket.on('connection', function(client) {

    // send last 20 blog posts
    Posts.find({}).sort('createdDate', 1).limit(20).execFind(function(err, obj) {
	if (obj != null)
	    client.send({action: 'initLoad', data: obj});
    });

    client.on('message', function(obj) {
	if (obj.action != null) {
	    switch (obj.action) {
	    case 'auth':
		Users.findOne({username: obj.data.user, password: obj.data.pass}, function (err,res) {
		    if (res != null) {
			client.auth = true;
			client.username = obj.data.user;
			client.mId = res._id;
			client.send({action: 'auth', data: true});
		    } else {
			console.log(err);
			console.log("failed attempt: u/p: "+obj.data.user+" "+obj.data.pass);
			client.send({action: 'auth', data: false});
		    }
		});		
		break;
	    case 'newPost':
		if (client.username == obj.data.user && client.auth == true) {
		    var newPost = new Posts(obj.data);
		    newPost.save(function(err) {
			if (!err) {
			    // broadcast new Post to all connected clients
			    socket.broadcast({action: 'newPost', data: newPost});
			}
		    });
		} else {
		    console.log("attempt to post without being logged in... Or as the wrong user...");
		}
		break;
	    case 'updatePost':
		if (client.username == obj.data.user && client.auth == true) {
		    Posts.findOne({user: obj.data.user, postId: obj.data.postId}, function(err, res) {
			if (!err) {
			    //perform update
			    res.story = obj.data.story;
			    res.title = obj.data.title;
			    res.save(function (err) {
				//broadcast change (to all except me)
				client.broadcast({'action': 'updatePost', 'data': res});
			    });
			} else {
			    console.log("didn't find blog to be updated _id:".obj.data.postId);
			}
		    });
		} else {
		    console.log("not logged in. Cannot update.");
		}
		break;
	    }
	}
    });
    client.on('disconnect', function() {
    });
});