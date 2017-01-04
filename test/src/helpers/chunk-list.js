'use strict';
var markdown = require('js-markdown-extra').Markdown;

module.exports = {
    'chunk-list': function (list, chunkSize) {
        var chunkedList = [];
        var scratchList = Array.from(list);
        while(scratchList.length){
            var chunk = [];
            while(scratchList.length && chunk.length < chunkSize){
                chunk.push(scratchList.shift());
            }
            chunkedList.push(chunk);
        }
        return chunkedList;
    }
};
