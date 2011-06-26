var socket;
var user;

$(document).ready(function() {
    socket = io.connect(null, {port:8080, connectTimeout:8000});
    
    socket.on('loadPosts', function(obj) {
	for (var i = 0; i < obj.data.length; i++) {
	    loadBlogEntry(obj.data[i]);
	}
    });

    socket.on('auth', function(obj) {
	if (obj.data == true && obj.user != null) {
	    user = obj.user;
	    // hide login form
	    $("#login").css('display', 'none');
	    // allow CRUD
	    $("#newPost").css('display', 'block');
	    // make user's posts editable
	    $("[postuser="+user+"]").each(function(index) {
		var postId = $(this).attr('postid');
		makePostEditable(this, postId);
	    });
	    
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
	if (user != null && user == obj.data.user) {
	    var el = $("[postid="+obj.data._id+"]");
	    makePostEditable(el, obj.data._id);
	}
    });

    socket.on('updatePost', function(obj) {
	var el = $("[postid="+obj.data._id+"]");
	updateBlogEntry(el, obj.data);
    });

    socket.on('deletePost', function(obj) {
	$("[postid="+obj.data._id+"]").remove();
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
    $("#loginForm").submit(function() {
	user = $("#user").val(); //global user var
	var pass = $("#pass").val();

	socket.emit('auth', {data: {user: user, pass: pass}}, function() {
	    pass = null;
	});
	return false;
    });

    // when a blog post is completed
    $("#newPostForm").submit(function() {
	var title = $("#title").val();
	var story = $("#story").val();
	
	$("#title").val('');
	$("#story").wysiwyg("setContent", "");

	socket.emit('newPost', {data: {user: user, title: title, story: story}});
	return false;
    });

    $("#story").wysiwyg({initialContent: ""});

    //once you reach the bottom of the page, load more posts (if there are any)
    $(window).scroll(function(){
        if ($(window).scrollTop() == $(document).height() - $(window).height()) {
	    //alert('reached bottom');
	    socket.emit('moreLoad', {});
        }
    });

});

function loadBlogEntry(post) {
var blogEntry = "<div id='blogEntry' postid='"+post._id+"' postuser='"+post.user+"'>\
<div id='title'>"+post.title+"</div>\
<div id='story'>"+post.story+"</div>\
<div id='byUser'>by "+post.user+" on "+post.createdDate+"</div>\
</div>";
    $("#blog").prepend(blogEntry);
}

function updateBlogEntry(el, post) {
    $(el).find("#title").html(post.title);
    $(el).find("#story").html(post.story);
}

function makePostEditable(el, postId) {
    $(el).prepend('<span class="deleteX"><a href="#" id="deleteX">X</a></span>');
    $(el).find('#deleteX').click(function() {
	var answer = confirm("Are you sure you want to delete this Post?");
	if (answer)
	    socket.emit('deletePost', {'data': {'user': user, 'postId': postId}});
	return false;
    });
    $(el).css('border-color', 'orange'); //indicate editable
    $(el).find("#title").editable(function(value, setting) {
	if (value != null) {
	    socket.emit('updatePost', {'data': {'user': user, 'postId': postId, 'title': value}});
	}
	return(value);
    }, {type: 'textarea', submit: 'OK', cancel: 'Cancel', tooltip: 'Click to edit...'});
    $(el).find("#story").editable(function(value, setting) {
	if (value != null) {
	    socket.emit('updatePost', {'data': {'user': user, 'postId': postId, 'story': value}});
	}
	return(value);
    }, {type: 'jwysiwyg', submit: 'OK', cancel: 'Cancel', tooltip: 'Click to edit...'});
}