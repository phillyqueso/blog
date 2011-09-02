var socket;
var user;
var postQuery = {};

var ismobile = navigator.userAgent.match(/(iPad)|(iPhone)|(iPod)|(android)|(webOS)/i); //check if a mobile device hit

$(document).ready(function() {
    socket = io.connect('/main');

    var userView = $("#userView").attr('title');
    if (userView)
	    postQuery.user = userView;
    
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
	    loadBlogEntryTop(obj.data);
    });

    socket.on('updatePost', function(obj) {
	    var el = $("[postid="+obj.data._id+"]");
	    updateBlogEntry(el, obj.data);
    });

    socket.on('deletePost', function(obj) {
	    $("[postid="+obj.data._id+"]").remove();
    });
    
    socket.on('connect', function(){
	    //console.log('Connected');
	    socket.emit("load", postQuery);
    });

    socket.on('disconnect', function() { 
        //console.log('Disconnected'); 
    });

    socket.on('reconnect', function() { 
	    //console.log('Reconnected to server');
	    $("#blog").html(""); //empty
	    socket.emit("load", postQuery);
    });

    socket.on('reconnecting', function( nextRetry ) { 
        //console.log('Attempting to re-connect to the server, next attempt in ' + nextRetry + 'ms'); 
    });
    
    socket.on('reconnect_failed', function(){ 
        //console.log('Reconnected to server FAILED.'); 
    });
    
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
        var commentsToggle = ($('#commentBool').attr('checked')) ? true : false;
	    
	    $("#title").val('');

        if (ismobile)
            $("#story").val('');
        else
	        $("#story").wysiwyg("setContent", "");
        
	    socket.emit('newPost', {data: {user: user, title: title, story: story, canComment: commentsToggle }});
	    return false;
    });
    
    if (!ismobile) {
        $("#story").wysiwyg({initialContent: ""});
    }

    
    $.wysiwyg.fileManager.setAjaxHandler("/upload");
    
    //once you reach the bottom of the page, load more posts (if there are any)
    $(window).scroll(function(){
        if ($(window).scrollTop() == $(document).height() - $(window).height()) {
	        var lastId = $(".blogEntry").filter(":last").attr('postid');
	        curQuery = postQuery;
	        curQuery.postId = lastId;
	        socket.emit('load', curQuery);
        }
    });
    
});

var strDateToString = function(strDate) {
    return strDate ? new Date(strDate).toString() : new Date().toString();
}

function loadBlogEntryTop(post) {
    var dateVar = strDateToString(post.createdDate);
    var blogEntry = "<div class='blogEntry' postid='"+post._id+"' postuser='"+post.user+"'>\
<div><a href='/posts/"+post._id+"'><span id='title'>"+post.title+"</span></a></div>\
<div id='story'>"+post.story+"</div>\
<div id='byUser'>by <a href='/"+post.user+"'>"+post.user+"</a> on "+dateVar+"</div>\
</div>";
    $("#blog").prepend(blogEntry);
    attemptEditable(post);
}

function loadBlogEntry(post) {
    var dateVar = strDateToString(post.createdDate);
    var blogEntry = "<div class='blogEntry' postid='"+post._id+"' postuser='"+post.user+"'>\
<div><a href='/posts/"+post._id+"'><span id='title'>"+post.title+"</span></a></div>\
<div id='story'>"+post.story+"</div>\
<div id='byUser'>by <a href='"+post.user+"'>"+post.user+"</a> on "+dateVar+"</div>\
</div>";
    $("#blog").append(blogEntry);
    attemptEditable(post);
}

function attemptEditable(post) {
    if (user != null && user == post.user) {
	    var el = $("[postid="+post._id+"]");
	    makePostEditable(el, post._id);
    }
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
    
    var titleLink = $(el).find("#title").parent();
    titleLink.after($(el).find("#title"));
    titleLink.html('(link)');
        
    $(el).find("#title").editable(function(value, setting) {
	    if (value != null) {
	        socket.emit('updatePost', {'data': {'user': user, 'postId': postId, 'title': value}});
	    }
	    return(value);
    }, {type: 'textarea', submit: 'OK', cancel: 'Cancel', tooltip: 'Click to edit...'});

    var storyFieldType = 'textarea';
    if (ismobile) storyFieldType = 'jwysiwyg';

    $(el).find("#story").editable(function(value, setting) {
	    if (value != null) {
	        socket.emit('updatePost', {'data': {'user': user, 'postId': postId, 'story': value}});
	    }
	    return(value);
    }, {type: storyFieldType, submit: 'OK', cancel: 'Cancel', tooltip: 'Click to edit...'});
}