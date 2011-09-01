var socket;
var user;

$(document).ready(function() {
    socket = io.connect('/comments');
    
    socket.on('loadComments', function(obj) {
	    //add to commentsCount
	    var cc = $("#commentsCount");
	    var commentsCount = parseInt($(cc).attr('class')) ? parseInt($(cc).attr('class')) : 0;
	    commentsCount += obj.length;
	    $(cc).attr('class', commentsCount);
	    $(cc).html(commentsCount+" comments");
        
	    for (var i = 0; i < obj.length; i++) {
	        loadComment(obj[i]);
	    }
    });
    
    socket.on('auth', function(obj) {
	    if (obj.data == true && obj.user != null) {
	        user = obj.user;
	        // hide login form
	        $("#login").css('display', 'none');
	        // allow commenting
	        $("#newComment").css('display', 'block');
	    } else {
	        // display auth failure
	        alert("auth failed");
	    }
    });
    
    socket.on('connect', function(){ 
	    //console.log('Connected'); 
	    $(".commendPool").html("");
	    var postId = $(".blogEntry").attr('postid');
	    socket.emit('getComments', {'postId': postId});
    });
    
    socket.on('disconnect', function() {
        //console.log('Disconnected'); 
    });

    socket.on('reconnect', function() {
        //console.log('Reconnected to server'); 
    });
    
    socket.on('reconnecting', function( nextRetry ) {
        //console.log('Attempting to re-connect to the server, next attempt in ' + nextRetry + 'ms'); 
    });
    socket.on('reconnect_failed', function() {
        //console.log('Reconnected to server FAILED.'); 
    });
    
    $("#loginForm").submit(function() {
	    user = $("#user").val(); //global user var
	    var pass = $("#pass").val();
        
	    socket.emit('auth', {data: {user: user, pass: pass}}, function() {
	        pass = null;
	    });
	    return false;
    });
    
    $(".commentText").click(function(){
	    if($(this).val() == $(this).attr("placeHolder")) {
	        $(this).val("");
	    }
    }).blur(function(){
	    if ($(this).val() == "") { //if empty
	        $(this).val($(this).attr("placeHolder"));
	    }
    });
    
    $(".submitContent").click(function() {
	    var postId = $(".blogEntry").attr('postid');
	    var ct = $(".commentText").val();
	    if (ct != "" && ct != $(".commentText").attr("placeHolder")) {
	        socket.emit('newComment', {'postId': postId, 'comment': ct, 'user': user}, function() {
		        $(".commentText").val($(".commentText").attr("placeHolder"));
	        });
	    }
    });
    
});

var loadComment = function(obj) {
    var dateVar = obj.createdDate ? new Date(obj.createdDate).toString() : new Date().toString();
    var commentEntry = "<div class='commentEntry'><div id='comment'>"+obj.user+" says: "+obj.comment+"</div><div id='dateOfEntry'>"+dateVar+"</div></div>";
    $(".commentPool").append(commentEntry);
}