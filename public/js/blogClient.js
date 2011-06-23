var socket;
var user;

$(document).ready(function() {
    socket = io.connect(null, {port:8080, connectTimeout:8000});
    
    socket.on('initLoad', function(obj) {
	for (var i = 0; i < obj.data.length; i++) {
	    loadBlogEntry(obj.data[i]);
	}
    });

    socket.on('auth', function(obj) {
	if (obj.data == true) {
	    if (obj.user != null)
		user = obj.user;
	    // hide login form
	    $("#login").css('display', 'none');
	    // allow CRUD
	    $("#newPost").css('display', 'block');
	} else {
	    // display auth failure
	    alert("auth failed");
	}
    });

    socket.on('newPost', function(obj) {
	// incr newPosts by 1
	// if "load new post" button is hidden, unhide
	// pass obj.data through loadBlogEntry function
	loadBlogEntry(obj.data);
    });

    socket.on('updatePost', function(obj) {
	// update
    });
    
    socket.on('connect', function(){ console.log('Connected'); });
    socket.on('disconnect', function(){ console.log('Disconnected'); });
    socket.on('reconnect', function(){ 
	$("#blog").html(""); //empty
	console.log('Reconnected to server');
    });
    socket.on('reconnecting', function( nextRetry ){ console.log('Attempting to re-connect to the server, next attempt in ' + nextRetry + 'ms'); });
    socket.on('reconnect_failed', function(){ console.log('Reconnected to server FAILED.'); });
    
    // when auth form is completed, attempt to login via blog's socket api
    $("#authSubmit").click(function() {
	user = $("#user").val(); //global user var
	var pass = $("#pass").val();

	socket.emit('auth', {data: {user: user, pass: pass}});
    });

    // when a blog post is completed
    $("#postSubmit").click(function() {
	var title = $("#title").val();
	var story = $("#story").val();
	
	$("#title").val('');
	$("#story").wysiwyg("setContent", "");

	socket.emit('newPost', {data: {user: user, title: title, story: story}});
    });

    $("#story").wysiwyg({initialContent: ""});

});

function loadBlogEntry(post) {
var blogEntry = "<div id='blogEntry' postid='"+post._id+"' postuser='"+post.user+"'>\
<div id='title'>"+post.title+"</div>\
<div id='story'>"+post.story+"</div>\
<div id='byUser'>by "+post.user+" on "+post.createdDate+"</div>\
</div>";
    $("#blog").prepend(blogEntry);
}
