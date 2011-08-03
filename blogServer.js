const express = require('express'),
connect = require('connect'),
form = require('connect-form'),
app = express.createServer(),
fs = require('fs'),
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
    app.set('view engine', 'jade');
    app.set('views', __dirname + '/views');
    app.use(express.logger());
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(form({ keepExtensions: true, uploadDir: __dirname + '/public/uploads/' }));
    app.use(express.cookieParser());
    app.use(express.session({ store: storage, secret: "p1ngp0ng" }));
    app.use(app.router);
    app.use(express.static(__dirname + '/public'));
    app.use(express.errorHandler());
});

app.param('postId', function(req, res, next, id) {
    Posts.findById(id, function(err, res) {
	if (err) return next(err);
	if (!res) return next(new Error('failed to find post'));
	req.post = res;
	next();
    });
});

app.get('/posts/:postId', function(req, res) {
    // inject the post into a layout/template
    console.log("got to: get/posts/postId");
    res.render('singlePost', { data: req.post });
});

app.get('/upload', function(req, res) {
    console.log("got to: get/upload");
    res.contentType('json');
    jsonRes = {"success" : false, "data" : {} };
    if (req.session.auth != null) {
	jsonRes.success = true;
	switch (req.param("action")) {
	case 'auth':
	    jsonRes.data = { 
		"move": {
		    "enabled": false,
		},
		"rename": {
		    "enabled": false,
		},
		"remove":  {
		    "enabled": false,
		},
		"mkdir":  {
		    "enabled": false,
		},
		"upload": {
		    "enabled": true,
		    "handler": "/upload",
		    "accept_ext": [".png",".jpeg",".jpg",".gif"]
		}
	    }
	    res.send(JSON.stringify(jsonRes));
	    break;
	case 'list':
	    jsonRes.data = {"files" : {}, "directories" : {} };
	    fs.readdir(__dirname + '/public/uploads/', function(err, files) {
		if (err) throw err;
		console.log("files: "+files);
		files.forEach(function(file) {
		    jsonRes.data.files[file] = 'http://' + req.header('host') + '/uploads/' + file;
		});
		res.send(JSON.stringify(jsonRes));
	    });
	    break;
	}
    } else {
	res.send(JSON.stringify(jsonRes));
    }
});

app.post('/upload', function(req, res, next) {
    console.log("got to: post/upload");
    req.form.complete(function(err, fields, files) {
	if (err) {
	    console.log("up error: "+err);
	    next(err);
	} else {
	    res.send("Upload complete.");
	}
    });

    req.form.on('progress', function(bytesReceived, bytesExpected) {
	console.log("progress");
	var percent = (bytesReceived / bytesExpected * 100) | 0;
	process.stdout.write('Uploading: %' + percent + '\r');
    });

});



app.param('username', function(req, res, next, username) {
    Users.findOne({'username': username}, function(err, res) {
	if (err) return next(err);
	if (!res) return next(new Error('failed to find blog for username: '+username));
	req.username = username;
	next();
    });
});

app.get('/:username', function(req, res) {
    console.log("got to: username");
    res.render('index', { username: req.username });
});

app.get('/', function(req, res) {
    console.log("got to: root");
    res.render('index');
});

app.listen(8080);

var auth = function(obj, client) {
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
}

var isAuthed = function(client) {
    //check for session/reload of page
    var clientCookies = connect.utils.parseCookie(client.handshake.headers.cookie);
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

var main = io.of('/main').on('connection', function(client) {
    isAuthed(client);

    client.on('auth', function(obj) {
	auth(obj, client);
    });

    client.on('newPost', function(obj) {
	if (client.auth != null) {
	    if (client.auth.username == obj.data.user) {
		obj.data.comments = {};
		var newPost = new Posts(obj.data);
		newPost.save(function(err) {
		    if (!err) {
			// broadcast new Post to all connected clients
			main.in(obj.data.user).emit('newPost', {data: newPost});
			main.in('main').emit('newPost', {data: newPost});
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
			    main.in(obj.data.user).emit('updatePost', {'data': res});
			    main.in('main').emit('updatePost', {'data': res});
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
			res.save(function(err) {
			    //broadcast delete
			    main.in(obj.data.user).emit('deletePost', {'data': {'_id': obj.data.postId}});
			    main.in('main').emit('deletePost', {'data': {'_id': obj.data.postId}});
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

    client.on('load', function(obj) {
	var q = {};
	if (obj) {
	    if (obj.postId)
		q._id = {"$lt": obj.postId};
	    if (obj.user) {
		q.user = obj.user;
		client.room = obj.user;
	    } else {
		client.room = 'main';
	    }
	    client.join(client.room);

	}
	Posts.find(q).sort('_id', -1).limit(perPage).execFind(function(err, res) {
	    if (res != null) {
		client.emit('loadPosts', {data: res});
	    }
	});
    });

});

var comments = io.of('/comments').on('connection', function(client) {
    isAuthed(client);

    client.on('auth', function(obj) {
	auth(obj, client);
    });

    client.on('getComments', function(obj) {
	if (obj.postId != null) {
	    client.join(obj.postId);
	    Posts.findById(obj.postId, function(err, res) {
		if (!err && res && res.comments) {
		    client.emit('loadComments', res.comments);
		} else {
		    console.log(err);
		}
	    });
	}
    });

    client.on('newComment', function(obj) {
	Posts.findById(obj.postId, function(err, res) {
	    if (!err && res) {
		var commentData = {user: client.auth.username, comment: obj.comment};
		res.comments.push(commentData);
		res.save(function(err) {
		    if (!err) {
			comments.in(obj.postId).emit('loadComments', [commentData]);
		    } else {
			console.log(err);
		    }
		});
	    }
	});
    });

    client.on('updateComment', function(obj) {
    });

    client.on('deleteComment', function(obj) {
    });

});