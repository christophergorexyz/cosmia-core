'use strict';
var markdown = require('js-markdown-extra').Markdown;

module.exports = {
    md: function (options) {
        return markdown(options.fn(this));
    },
    'md-file': function(options){
        //TODO: read markdown file and render it
        return markdown('#TODO');
    }
};
