'use strict';

let fs = require('fs');
let path = require('path');
let mkdirp = require('mkdirp'); //like `mkdir -p`

let assign = require('lodash.assign');

let recursiveReaddir = require('recursive-readdir');
let handlebars = require('handlebars');

let htmlparser = require('htmlparser2');
let domutils = htmlparser.DomUtils;

let chalk = require('chalk');


const EXTENSION_HBS = '.hbs';
const EXTENSION_JSON = '.json';
const EXTENSION_JS = '.js';

const COSMIA_PARTIAL_PATH = 'views/partials';
const COSMIA_DATA_PATH = 'views/data';
const COSMIA_LAYOUT_PATH = 'views/layouts';
const COSMIA_HELPERS_PATH = 'views/helpers';
const COSMIA_PAGES_PATH = 'views/pages';

const COSMIA_SCRIPT = 'cosmia-script';
const COSMIA_DATA = 'cosmia-data';
const COSMIA_TEMPLATE_DATA = 'cosmia-template-data';

const PACKAGE_NAME = chalk.blue('cosmia-core');

const ERROR_MESSAGE_COSMIA_CUSTOM_CHILD = 'cosmia custom elements may only have a single text child.';
const ERORR_MESSAGE_COSMIA_CUSTOM_ELEMENT = 'Only one of a given type of cosmia custom element is allowed per page.';


var siteData = {};
var handlebarsLayouts = {};
var pageData = [];

var partialsDir = '';
var dataDir = '';
var layoutsDir = '';
var helpersDir = '';
var pagesDir = '';


//Used to pull a cosmia-* element from the
function _extractCustomPageElement(page, attribute, process) {
    //parse the html and dig out the relevant data element by custom attribute
    var dom = new htmlparser.parseDOM(page.content);

    //find an element with the specified `attribute`
    var dataElements = domutils.find((e) =>
        (e.attribs !== undefined && e.attribs[attribute] !== undefined),
        dom, true);

    if (dataElements.length > 1) {
        throw ERORR_MESSAGE_COSMIA_CUSTOM_ELEMENT;
    }

    if (dataElements.length) {
        var element = dataElements[0];

        if (element.children.length > 1) {
            throw ERROR_MESSAGE_COSMIA_CUSTOM_CHILD;
        }

        if (element.children.length) {
            try {
                page[attribute] = process(element);
            } catch (err) {
                throw page.path + '\n' + err;
            }
        }

        //this doesn't seem like the fastest approach, but the domUtils removeElement call
        //doesn't appear to work correctly/how i'd expect it to, and is not documented
        //...this might work better using streams...
        page.content = domutils.getOuterHTML(dom).replace(domutils.getOuterHTML(element), '');

    }
    return page;
}


function _registerDataFile(name, content) {
    siteData[path.basename(name)] = JSON.parse(content);
}

function _registerPartialFile(name, content) {
    handlebars.registerPartial(path.basename(name), content);
}

function _registerLayoutFile(name, content) {
    var layout = {
        content: content,
        path: name
    };
    layout = _extractCustomPageElement(layout, COSMIA_TEMPLATE_DATA, (e) => JSON.parse(domutils.getInnerHTML(e)));
    layout.compile = handlebars.compile(layout.content);
    handlebarsLayouts[path.basename(name)] = layout;
}

function _registerHelperFile(name, content) {
    handlebars.registerHelper(require(path.resolve(name)));
}

function _processPage(name, content) {
    var page = {
        path: name,
        content: content
    };
    page = _extractCustomPageElement(page, COSMIA_DATA, (e) => JSON.parse(domutils.getInnerHTML(e)));
    page = _extractCustomPageElement(page, COSMIA_SCRIPT, (e) => domutils.getOuterHTML(e));
    pageData.push(page);
}


//read all the files of a given type in a directory and execute a process on their content
//the processor takes the form function (name, content){ ... }
function _processDirectory(dirName, extension, processor) {
    return new Promise((resolve, reject) => {
        recursiveReaddir(dirName, (err, files) => {
            if (err) {
                reject(err);
                return;
            }
            files.forEach((filename) => {
                var matches = new RegExp('^([^.]+)' + extension + '$').exec(filename);
                if (matches) {
                    var nameWithoutExtension = matches[1];
                    var fileContent = fs.readFileSync(path.resolve(dirName, filename), 'utf8');
                    try {
                        processor(nameWithoutExtension, fileContent);
                    } catch (err) {
                        reject(err);
                        return;
                    }
                }
            });

            return resolve();
        });
    });
}


function _registerAppComponents() {
    //register assemble's handlebars helpers
    handlebars.registerHelper(require('handlebars-helpers')());

    //register custom layouts, partials, data, and helpers
    return Promise.all([
        _processDirectory(partialsDir, EXTENSION_HBS, _registerPartialFile),
        _processDirectory(dataDir, EXTENSION_JSON, _registerDataFile),
        _processDirectory(layoutsDir, EXTENSION_HBS, _registerLayoutFile),
        _processDirectory(helpersDir, EXTENSION_JS, _registerHelperFile)
    ]);
}

function _compilePages(outputDir) {
    return new Promise((resolve, reject) => {
        for (var p in pageData) {
            try {
                //TODO: make sure cosmia custom elements are set in a single pass.
                //as it stands, we'll need two new lines for each additional custom
                //element, but it could be reduced to one new line
                var pageContext = assign({}, siteData, pageData[p]['cosmia-data']);
                pageContext['cosmia-script'] = pageData[p]['cosmia-script'];
                pageContext['cosmia-data'] = pageData[p]['cosmia-data'];

                var canonicalPath = path.join('/', pageData[p].path.replace(pagesDir, '') + '.html');

                //ideally, everything should be an index.html file in the end
                //if it's not, we'll leave the full path in the canonical url
                if (/^index.html$/.test(path.basename(canonicalPath))) {
                    canonicalPath = canonicalPath.replace(path.basename(canonicalPath), '');
                }

                pageContext['page-path'] = canonicalPath;

                var pageLayoutName = (pageContext.layout ? pageContext.layout : 'default');
                var compiledPage = handlebars.compile(pageData[p].content);
                var pageBody = compiledPage(pageContext);


                if (handlebarsLayouts[pageLayoutName] === undefined ) {
                    console.warn(PACKAGE_NAME + ": " + chalk.yellow("WARNING: Layout") + " `" + pageLayoutName + "` " + chalk.yellow("not found. Using") + " `default` " + chalk.yellow('instead.'));
                    pageLayoutName = 'default';
                }

                var layoutName = pageLayoutName;
                var templateData = null;
                pageContext['cosmia-template-data'] = {};
                do{
                    templateData = handlebarsLayouts[layoutName]['cosmia-template-data'];
                    pageContext['cosmia-template-data'] = assign({}, (templateData ? templateData : {}), pageContext['cosmia-template-data']);
                    layoutName = templateData && templateData.parent ? templateData.parent : false;
                } while (layoutName);

                templateData = pageContext['cosmia-template-data'];

                layoutName = pageLayoutName;

                do {
                    pageBody = (handlebarsLayouts[layoutName]).compile(assign({}, {
                        body: pageBody
                    }, pageContext));
                    templateData = handlebarsLayouts[layoutName]['cosmia-template-data'];
                    layoutName = templateData && templateData.parent ? templateData.parent : false;
                } while (layoutName);

                var outputPath = path.resolve(pageData[p].path.replace(pagesDir, outputDir) + '.html');

                //doing this stuff synchronously to avoid race conditions
                mkdirp.sync(path.dirname(outputPath));
                fs.writeFileSync(outputPath, pageBody, 'utf8');
            } catch (err) {
                reject(err);
                return;
            }
        }
        return resolve();
    });
}


function Cosmia(srcFolder, distFolder) {
    try {
        partialsDir = path.resolve(srcFolder, COSMIA_PARTIAL_PATH);
        dataDir = path.resolve(srcFolder, COSMIA_DATA_PATH);
        layoutsDir = path.resolve(srcFolder, COSMIA_LAYOUT_PATH);
        helpersDir = path.resolve(srcFolder, COSMIA_HELPERS_PATH);
        pagesDir = path.resolve(srcFolder, COSMIA_PAGES_PATH);

        //TODO: this structure seems weird to me. should probably be rewritten
        //I don't like having to `catch` so often, and i'd rather it to all bubble
        //up to the outer try/catch instead of duplicating it in the promise
        Promise.resolve()
            .then(() => {
                return _registerAppComponents().then(() => {
                    console.log(chalk.blue(PACKAGE_NAME) + ': components registered');
                }).catch((err) => {
                    throw err;
                });
            })
            .then(() => {
                return _processDirectory(pagesDir, EXTENSION_HBS, _processPage).then(() => {
                    console.log(chalk.blue(PACKAGE_NAME) + ': data extracted');
                }).catch((err) => {
                    throw err;
                });
            })
            .then(() => {
                return _compilePages(distFolder).then(() => {
                    console.log(chalk.blue(PACKAGE_NAME) + ': pages compiled');
                }).catch((err) => {
                    throw err;
                });
            }).catch((err) => {
                console.error(chalk.red(err));
                process.exitCode = 1;
            });
    } catch (err) {
        console.error(chalk.red(err));
        process.exitCode = 1;
    }
}

module.exports = Cosmia;
