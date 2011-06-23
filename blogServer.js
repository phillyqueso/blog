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
    client.get("auth", function(res) {
	if (res != null) {
	    console.log("recognized user: " + res.user);
	    client.emit('auth', {data: true, user: res.user});
	} else {
	    console.log(res+" sessions missed...");
	}
    });

    // send last 20 blog posts
    Posts.find({}).sort('createdDate', 1).limit(20).execFind(function(err, obj) {
	if (obj != null)
	    client.emit('initLoad', {data: obj});
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
	    console.log(client.auth);
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
		Posts.findOne({user: obj.data.user, postId: obj.data.postId}, function(err, res) {
		    if (!err) {
			//perform update
			res.story = obj.data.story;
			res.title = obj.data.title;
			res.save(function (err) {
			    //broadcast change (to all except me)
			    io.sockets.emit('updatePost', {'data': res});
			});
		    } else {
			console.log("didn't find blog to be updated _id:".obj.data.postId);
		    }
		});
	    } else {
		console.log("not logged in. Cannot update.");
	    }
	}
    });

});