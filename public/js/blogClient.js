var socket;
var user;

$(document).ready(function() {

    socket = new io.Socket(null, {port:8080, rememberTranspot: false});
    socket.connect();
    
    socket.on('message', function(obj) {
	if (obj.action != null) {
	    switch (obj.action) {
	    case 'initLoad':
		for (var i = 0; i < obj.data.length; i++) {
		    loadBlogEntry(obj.data[i]);
		}
		break;
	    case 'auth':
		if (obj.data == true) {
		    // hide login form
		    $("#login").css('display', 'none');
		    // allow CRUD
		    $("#newPost").css('display', 'block');
		} else {
		    // display auth failure
		    alert("auth failed");
		}
		break;
	    case 'newPost':
		// incr newPosts by 1
		// if "load new post" button is hidden, unhide
		// pass obj.data through loadBlogEntry function
		loadBlogEntry(obj.data);
		break;
	    }
	}
    });
    
    socket.on('connect', function(){ console.log('Connected'); });
    socket.on('disconnect', function(){ console.log('Disconnected'); });
    socket.on('reconnect', function(){ console.log('Reconnected to server'); });
    socket.on('reconnecting', function( nextRetry ){ console.log('Attempting to re-connect to the server, next attempt in ' + nextRetry + 'ms'); });
    socket.on('reconnect_failed', function(){ console.log('Reconnected to server FAILED.'); });
    
    // when auth form is completed, attempt to login via blog's socket api
    $("#authSubmit").click(function() {
	user = $("#user").val(); //global user var
	var pass = $("#pass").val();

	socket.send({action: 'auth', data: {user: user, pass: pass}});
    });

    // when a blog post is completed
    $("#postSubmit").click(function() {
	var title = $("#title").val();
	var story = $("#story").val();
	
	$("#title").val('');
	$("#story").wysiwyg("setContent", "");

	socket.send({action: 'newPost', data: {user: user, title: title, story: story}});
    });

    $("#story").wysiwyg({initialContent: ""});

});

function loadBlogEntry(post) {
var blogEntry = "<div id='blogEntry' blogid='"+post._id+"' bloguser='"+post.user+"'>\
<div id='title'>"+post.title+"</div>\
<div id='story'>"+post.story+"</div>\
<div id='byUser'>by "+post.user+" on "+post.createdDate+"</div>\
</div>";
    $("#blog").prepend(blogEntry);
}
