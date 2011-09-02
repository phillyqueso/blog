var _ = require('underscore');

var config = {
    build : process.env.NODE_ENV || 'development',
    production : {
	    host : 'http://xeekr.com',
	    port : 8080
    },
    
    development : {
	    host : 'http://local.host',
	    port: 7777
    },

    all : {
        clientConfig: {
            blogName: 'Xeekr Blog',
            blogFooter: 'Footer here...' // for something more custom; replace #{config.blogFooter} in the views
        },
        commentsToggle: true, // allows users to turn comments on/off for their content
        contentProtection: false, // true if auth required to view content.
        pageSize: 10,
        sessionSecret: 'p1ngp0ng'
    }
}

configBuild = _.extend(config.all, config[config.build])
console.log('running config: ' + config.build);

exports.config = configBuild;