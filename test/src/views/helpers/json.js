'use strict';
var markdown = require('js-markdown-extra').Markdown;

module.exports = {
    json: function (context) {
        return JSON.stringify(context);
    }
};
