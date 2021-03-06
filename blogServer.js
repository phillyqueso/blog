const express = require('express'),
connect = require('connect'),
form = require('connect-form'),
app = express.createServer(),
fs = require('fs'),
io = require('socket.io').listen(app),
config = require('./config.js').config,
mongoose = require('mongoose'),
db = mongoose.connect('mongodb://localhost/blog'),
fields = ['createdDate', 'canComment', 'story', 'title', 'user']; // limited fields for posts query

var storage = new express.session.MemoryStore();

var users = require(__dirname + '/models/users.js');
var posts = require(__dirname + '/models/posts.js');

var Users = mongoose.model('users');
var Posts = mongoose.model('posts');

const perPage = config.pageSize;

app.configure(function() {
    app.set('view engine', 'jade');
    app.set('views', __dirname + '/views');
    app.use(express.favicon());
    app.use(express.logger());
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(form({ keepExtensions: true, uploadDir: __dirname + '/public/uploads/' }));
    app.use(express.cookieParser());
    app.use(express.session({ store: storage, secret: config.sessionSecret }));
    app.use(express.static(__dirname + '/public'));
    app.use(app.router);
});

app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
    app.use(express.errorHandler()); 
});

app.param('postId', function(req, res, next, id) {
    if (config.contentProtection == true && !req.session.auth) {
        req.post = false;
        next();
    } else {
        Posts.findById(id, function(err, res) {
	        if (err) return next(err);
	        if (!res) return next(new Error('failed to find post'));
	        req.post = res;
            next();
        });
    }
});


app.get('/posts/:postId', function(req, res) {
    // inject the post into a layout/template
    console.log("got to: get/posts/postId");
    if (req.post == false) return res.redirect('/');
    res.render('singlePost', { config: config.clientConfig, data: req.post });
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
            
	        var finalDir = __dirname + '/public/uploads/' + req.session.auth.username + '/';
	        fs.readdir(finalDir, function(err, files) {
		        if (err) {
		            fs.mkdir(finalDir, 0777, function(err) {
			            if (err) {
			                console.log(err);
			                throw err;
			            }
		            });
		        } else {
		            files.forEach(function(file) {
			            jsonRes.data.files[file] = 'http://' + req.header('host') + '/uploads/' + req.session.auth.username + '/' + file;
		            });
		        }
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
    if (req.session.auth != null) {
	    var finalDir = __dirname + '/public/uploads/' + req.session.auth.username + '/';
	    req.form.complete(function(err, fields, files) {
	        if (err) {
		        console.log("up error: "+err);
		        next(err);
	        } else {
		        fs.rename(files.handle.path, finalDir + files.handle.name, function(err) {
		            if (err) {
			            console.log(err);
			            res.send("problem uploading file");
		            }
		            res.send("Upload complete.");
		        });
	        }
	    });
	    
	    req.form.on('progress', function(bytesReceived, bytesExpected) {
	        console.log("progress");
	        var percent = (bytesReceived / bytesExpected * 100) | 0;
	        process.stdout.write('Uploading: %' + percent + '\r');
	    });
    } else {
	    next("Can't upload filed without being logged in.");
    }
});



app.param('username', function(req, res, next, username) {
    if (config.contentProtection == true && !req.session.auth) {
        req.username = false;
        next();
    } else {
        Users.findOne({'username': username}, function(err, res) {
	        if (err) return next(err);
	        if (!res) return next(new Error('failed to find blog for username: '+username));
	        req.username = username;
	        next();
        });
    }
});

app.get('/:username', function(req, res) {
    console.log("got to: username");
    if (req.username == false)
        res.redirect('/');
    else
        res.render('index', { config: config.clientConfig,  username: req.username });
});

app.get('/', function(req, res) {
    console.log("got to: root");
    res.render('index', { config: config.clientConfig });
});

app.listen(config.port);

var auth = function(obj, client) {
    Users.findOne({'username': obj.data.user, 'password': obj.data.pass}, function (err,res) {
	    if (res != null) {
	        client.auth =  { username : res.username, _id : res._id };
	        if (client.session) {
		        client.session['auth'] = client.auth;
		        storage.set(client.sid, client.session);
	        }

    	    client.emit('auth', {data: true, user: res.username});

            if (config.contentProtection == true) { // if content protection is on, emit stories at auth success;
                Posts.find({}).sort('_id', -1).limit(perPage).execFind(function(err, res) {
	                if (res != null) {
		                client.emit('loadPosts', {data: res});
	                }
	            })
            }

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
        if (config.contentProtection == true && !client.auth) {
            // do nothing
        } else {
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
	        Posts.find(q, fields).sort('_id', -1).limit(perPage).execFind(function(err, res) {
	            if (res != null) {
		            client.emit('loadPosts', {data: res});
	            }
	        });
        }
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
                if (res.canComment == false) {
                    console.log('attempting to comment on content that cannot be commented on');
                } else {
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
	        }
	    });
    });
    
    client.on('updateComment', function(obj) {
    });
    
    client.on('deleteComment', function(obj) {
    });
    
});