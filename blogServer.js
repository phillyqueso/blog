const express = require('express'),
app = express.createServer(),
io = require('socket.io').listen(app),
mongoose = require('mongoose'),
db = mongoose.connect('mongodb://localhost/blog');

var storage = new express.session.MemoryStore();

var users = require(__dirname + '/models/users.js');
var posts = require(__dirname + '/models/posts.js');

var Users = mongoose.model('users');
var Posts = mongoose.model('posts');

const perPage = 20;

app.configure(function() {
    app.use(express.logger());
    app.use(express.methodOverride());
    app.use(express.bodyParser());
    app.use(express.cookieParser());
    app.use(express.session({ store: storage, secret: "p1ngp0ng" }));
    app.use(app.router);
    app.use(express.static(__dirname + '/public'));
    app.use(express.errorHandler());
});

app.dynamicHelpers({
    session: function(req, res) {
	return req.session;
    }
});

app.get('/', function(req, res, next){
    //console.log(req.cookies['connect.sid']);
    next();
});

app.listen(8080);

io.sockets.on('connection', function(client) {
    //this will begin to work once set/get works properly
/*
    client.get("auth", function(res) {
	if (res != null) {
	    console.log("recognized user: " + res.user);
	    client.emit('auth', {data: true, user: res.user});
	} else {
	    console.log(res+" sessions missed...");
	}
    });
*/

    client.curPage = 1; // initalize current page to 1 for client

    // send last 20 blog posts
    Posts.find({}).sort('createdDate', 1).limit(perPage).execFind(function(err, obj) {
	if (obj != null)
	    client.emit('loadPosts', {data: obj});
    });

    client.on('auth', function(obj) {
	Users.findOne({'username': obj.data.user, 'password': obj.data.pass}, function (err,res) {
	    if (res != null) {
		client.auth =  { username : res.username, _id : res._id };
    		client.emit('auth', {data: true, user: res.username});
	    } else {
		console.log(err);
		console.log("failed attempt: u/p: "+obj.data.user+" "+obj.data.pass);
		client.emit('auth', {data: false});
	    }
	});
    });

    client.on('newPost', function(obj) {
	if (client.auth != null) {
	    if (client.auth.username == obj.data.user) {
		var newPost = new Posts(obj.data);
		newPost.save(function(err) {
		    if (!err) {
			// broadcast new Post to all connected clients
			io.sockets.emit('newPost', {data: newPost});
		    }
		});
	    } else {
		console.log("attempt to post without being logged in... Or as the wrong user...");
	    }
	}
    });
    
    client.on('updatePost', function(obj) {
	if (client.auth != null) {
	    if (client.auth.username == obj.data.user) {
		Posts.findOne({user: client.auth.username, _id: obj.data.postId}, function(err, res) {
		    if (!err) {
			//perform update
			if (obj.data.story != null)
			    res.story = obj.data.story;
			if (obj.data.title != null)
			    res.title = obj.data.title;
			res.save(function (err) {
			    //broadcast change (to all except me)
			    client.broadcast.emit('updatePost', {'data': res});
			});
		    } else {
			console.log("didn't find post to be updated _id:".obj.data.postId);
		    }
		});
	    } else {
		console.log("not logged in. Cannot update.");
	    }
	}
    });

    client.on('deletePost', function(obj) {
	if (client.auth != null) {
	    if (client.auth.username == obj.data.user) {
		Posts.findOne({user: client.auth.username, _id: obj.data.postId}, function(err, res) {
		    if (!err) {
			res.remove();
			res.save(function (err) {
			    //broadcast delete
			    io.sockets.emit('deletePost', {'data': {'_id': obj.data.postId}});
			});
		    } else {
			console.log("didn't find post to be deleted _id:".obj.data.postId);
		    }
		});
	    } else {
		console.log("not logged in. Cannot delete post.");
	    }
	}
    });

    client.on('moreLoad', function() {
	// send last 20 blog posts
	Posts.find({}).sort('createdDate', 1).skip(client.curPage * perPage).limit(perPage).execFind(function(err, obj) {
	    if (obj != null) {
		client.emit('loadPosts', {data: obj});
		client.curPage++;
	    }

	});

    });

});