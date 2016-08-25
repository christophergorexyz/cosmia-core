'use strict';

let fs = require('fs');
let path = require('path');

let assign = require('lodash.assign');

let recursiveReaddir = require('recursive-readdir');
let handlebars = require('handlebars');

let htmlparser = require('htmlparser2');


const EXTENSION_HBS = '.hbs';
const EXTENSION_JSON = '.json';
const EXTENSION_JS = '.js';

const COSMIA_PARTIAL_PATH = 'src/views/partials';
const COSMIA_DATA_PATH = 'src/views/data';
const COSMIA_LAYOUT_PATH = 'src/views/layouts';
const COSMIA_HELPERS_PATH = 'src/views/helpers';
const COSMIA_PAGES_PATH = 'src/views/pages';

const PACKAGE_NAME = 'cosmia-core';


const ERROR_MESSAGE = {
    'cosmia-data-child': 'The cosmia-data element may only have a single text child.',
    'cosmia-data-element': ': Only one cosmia-data element is allowed per page.'
};


var siteData = {};
var compiledLayouts = {};
var pageData = {};

var partialsDir = '';
var dataDir = '';
var layoutsDir = '';
var helpersDir = '';
var pagesDir = '';

//read all the files of a given type in a directory and execute a process on their content
//the processor takes the form function (name, content){ ... }
function _processDirectory(dirName, extension, processor) {
    return new Promise((resolve, reject) => {
        recursiveReaddir(dirName, (err, files) => {
            if (err) {
                return reject(err);
            }
            files.forEach((filename) => {
                var matches = new RegExp('^([^.]+)' + extension + '$').exec(filename);
                if (matches) {
                    var nameWithoutExtension = matches[1];
                    var fileContent = fs.readFileSync(path.resolve(dirName, filename), 'utf8');
                    processor(nameWithoutExtension, fileContent);
                }
            });
            return resolve();
        });
    });
}


function _registerDataFile(name, content) {
    siteData[name] = JSON.parse(content);
}

function _registerPartialFile(name, content) {
    handlebars.registerPartial(name, content);
}

function _registerLayoutFile(name, content) {
    compiledLayouts[name] = handlebars.compile(content);
}

function _registerHelperFile(name, content) {
    handlebars.registerHelper(require(path.resolve(name)));
}


function _processPage(name, content) {

    pageData[name] = {};

    //parse the html and dig out the relevant data element by custom attribute
    var dom = new htmlparser.parseDOM(content);
    var domUtils = htmlparser.DomUtils;

    //find an element with the "proprietary" attribute `cosmia-data`
    var dataElements = domUtils.find((e) => {
        return e.attribs && e.attribs['cosmia-data'] !== null;
    }, dom, true);

    if (dataElements.length > 1) {
        throw new Error(ERROR_MESSAGE['cosmia-data-element']);
    }

    if (dataElements.length) {
        var element = dataElements[0];

        if (element.children.length > 1) {
            throw new Error(ERROR_MESSAGE['cosmia-data-child']);
        }

        if (element.children.length) {
            var childElement = element.children[0];
            if (childElement.type !== 'text') {
                throw new Error(ERROR_MESSAGE['cosmia-data-child']);
            }

            try {
                pageData[name]['page-data'] = JSON.parse(childElement.data);
            } catch (err) {
                throw new Error(err);
            }
        }

        //TODO: strip data element from content
    }

    //TODO: add support for page-scripts
}


function _registerAppComponents() {
    //register assemble's handlebars helpers
    handlebars.registerHelper(require('handlebars-helpers')());

    //register custom layouts, partials, data, and helpers
    Promise.all([
        _processDirectory(partialsDir, EXTENSION_HBS, _registerPartialFile),
        _processDirectory(dataDir, EXTENSION_JSON, _registerDataFile),
        _processDirectory(layoutsDir, EXTENSION_HBS, _registerLayoutFile),
        _processDirectory(helpersDir, EXTENSION_JS, _registerHelperFile)
    ]).then(() => {
        console.log(PACKAGE_NAME + ': components registered');
    }).catch((err) => {
        throw err;
    });
}

function _buildApp() {
    _processDirectory(COSMIA_PAGES_PATH, EXTENSION_HBS, _processPage).then(() => {
        console.log(PACKAGE_NAME + ': pages compiled');
        //TODO: write files
    }).catch((err) => {
        throw err;
    });
}

function cosmiaTransformStream(file, cb) {
    var compiledFile = handlebars.compile(String(file.contents));
    var fileContent = compiledFile(assign({}, siteData, file.frontMatter));

    var finalPage = compiledLayouts[(file.layout ? file.layout : 'default')](assign({}, {
        body: fileContent,
    }, siteData, file.frontMatter));
    file.contents = new Buffer(finalPage);
    cb(null, file);
}


function Cosmia(projectFolder, outputFolder) {
    partialsDir = path.resolve(projectFolder, COSMIA_PARTIAL_PATH);
    dataDir = path.resolve(projectFolder, COSMIA_DATA_PATH);
    layoutsDir = path.resolve(projectFolder, COSMIA_LAYOUT_PATH);
    helpersDir = path.resolve(projectFolder, COSMIA_HELPERS_PATH);
    pagesDir = path.resolve(projectFolder, COSMIA_HELPERS_PATH);

    try {
        _registerAppComponents();
        _buildApp();
    } catch (err) {
        console.error(PACKAGE_NAME + ': ' + err);
        process.exitCode = 1;
    }

    //return eventstream.map(cosmiaTransformStream);
}

module.exports = Cosmia;
