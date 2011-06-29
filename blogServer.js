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

const perPage = 10;

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

app.listen(8080);

parseCookie = function(str){
  var obj = {}
    , pairs = str.split(/[;,] */);
  for (var i = 0, len = pairs.length; i < len; ++i) {
    var pair = pairs[i]
      , eqlIndex = pair.indexOf('=')
      , key = pair.substr(0, eqlIndex).trim().toLowerCase()
      , val = pair.substr(++eqlIndex, pair.length).trim();

    // Quoted values
    if (val[0] === '"') {
      val = val.slice(1, -1);
    }

    // Only assign once
    if (obj[key] === undefined) {
      obj[key] = decodeURIComponent(val.replace(/\+/g, ' '));
    }
  }
  return obj;
};

io.sockets.on('connection', function(client) {
    // send last 20 blog posts
    Posts.find().sort("_id", -1).limit(perPage).execFind(function(err, obj) {
	if (obj != null) {
	    client.emit('loadPosts', {data: obj});

	    //check for session/reload of page
	    var clientCookies = parseCookie(client.handshake.headers.cookie);
	    client.sid = clientCookies['connect.sid'];
	    
	    storage.get(client.sid, function(err, res) {
		if (res != null) {
		    client.session = res;
		    if (res.auth != null) {
			client.auth = res.auth;
			console.log("recognized user: " + res.auth.username);
			client.emit('auth', {data: true, user: res.auth.username});
		    }
		} else {
		    console.log(res+" sessions missed...");
		}
	    });	    
	}
    });

    //emit on definitions
    client.on('auth', function(obj) {
	Users.findOne({'username': obj.data.user, 'password': obj.data.pass}, function (err,res) {
	    if (res != null) {
		client.auth =  { username : res.username, _id : res._id };
		if (client.session) {
		    client.session['auth'] = client.auth;
		    storage.set(client.sid, client.session);
		}
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

    client.on('moreLoad', function(obj) {
	Posts.find({_id: { "$lt": obj.data.postId } }).sort('_id', -1).limit(perPage).execFind(function(err, res) {
	    if (res != null) {
		client.emit('loadPosts', {data: res});
	    }
	});
    });

});