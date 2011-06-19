const connect = require('connect'),
mongoose = require('mongoose'),
db = mongoose.connect('mongodb://localhost/blog');

var users = require(__dirname + '/models/users.js');
var posts = require(__dirname + '/models/posts.js');

var Users = mongoose.model('users');
var Posts = mongoose.model('posts');

var server = connect.createServer(
    connect.basicAuth(function(user, pass) {
	return Users.findOne({username: user, password: pass}, function (err,obj) {
	    if (obj != null) {
		return true;
	    } else {
		console.log(err);
		console.log("failed attempt: u/p: "+user+" "+pass);
		return false;
	    }
	});
    }),
    connect.favicon(),
    connect.logger(),
    connect.cookieParser(),
    connect.session({ secret: 'myej.orgsecret' }),
    connect.static(__dirname + '/public')
).listen(8080);