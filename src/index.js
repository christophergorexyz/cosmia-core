'use strict';

import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp'; //like `mkdir -p`

import keys from 'lodash.keys';

import recursiveReaddir from 'recursive-readdir';
import handlebars from 'handlebars';

import htmlparser, {
    DomUtils
}
from 'htmlparser2';

import chalk from 'chalk';

const EXTENSION_HBS = '.hbs';
const EXTENSION_JSON = '.json';
const EXTENSION_JS = '.js';

const COSMIA_PARTIAL_PATH = 'views/partials';
const COSMIA_DATA_PATH = 'views/data';
const COSMIA_LAYOUT_PATH = 'views/layouts';
const COSMIA_HELPERS_PATH = 'views/helpers';
const COSMIA_PAGES_PATH = 'views/pages';
const COSMIA_COLLECTIONS_PATH = 'views/collections';

const COSMIA_SCRIPT = 'cosmia-script';
const COSMIA_DATA = 'cosmia-data';
const COSMIA_TEMPLATE_DATA = 'cosmia-template-data';

const PACKAGE_NAME = chalk.blue('cosmia-core');

const ERROR_MESSAGE_COSMIA_CUSTOM_CHILD = 'cosmia custom elements may only have a single text child.';
const ERORR_MESSAGE_COSMIA_CUSTOM_ELEMENT = 'Only one of a given type of cosmia custom element is allowed per page.';

var siteData = {};
var handlebarsLayouts = {};
var pageData = {};

var partialsDir = '';
var dataDir = '';
var layoutsDir = '';
var helpersDir = '';
var pagesDir = '';

//Used to pull an element with a cosmia-* attribute from the .hbs file
function _extractCustomPageElement(page, attribute, process) {
    //parse the html and dig out the relevant data element by custom attribute
    var dom = new htmlparser.parseDOM(page.content);

    //find an element with the specified `attribute`
    var dataElements = DomUtils.find((e) =>
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

        //this doesn't seem like the fastest approach, but the DomUtils removeElement call
        //doesn't appear to work correctly/how i'd expect it to, and is not documented,
        //so falling back to a string operation
        page.content = DomUtils.getOuterHTML(dom).replace(DomUtils.getOuterHTML(element), '');
    }
    return page;
}

function _registerDataFile(name, content) {
    var splitPath = name.replace(dataDir + '/', '').split('/');
    var treeNode = siteData;
    var objectName = '';
    var dataObject = JSON.parse(content);
    while (splitPath.length) {
        objectName = splitPath.shift();
        treeNode[objectName] = splitPath.length ? Object.assign({}, treeNode[objectName]) : dataObject;
        treeNode = treeNode[objectName];
    }
}

function _registerPartialFile(name, content) {
    handlebars.registerPartial(path.basename(name), content);
}

function _registerLayoutFile(name, content) {
    var layout = {
        content: content,
        path: name
    };
    layout = _extractCustomPageElement(layout, COSMIA_TEMPLATE_DATA, (e) => JSON.parse(DomUtils.getInnerHTML(e)));
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
    page = _extractCustomPageElement(page, COSMIA_DATA, (e) => JSON.parse(DomUtils.getInnerHTML(e)));
    page = _extractCustomPageElement(page, COSMIA_SCRIPT, (e) => DomUtils.getOuterHTML(e));
    var keyName = path.join('.', name.replace(pagesDir, ''));
    pageData[keyName] = page;
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
                if (path.extname(filename) === extension) {

                    var nameWithoutExtension = path.resolve(path.dirname(filename), path.basename(filename, extension));
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

function _compilePage(page, customData = {}, silent = false) {

    //TODO: make sure cosmia custom elements are set in a single pass.
    //as it stands, we'll need two new lines for each additional custom
    //element, but it could be reduced to one new line
    var pageContext = Object.assign({}, siteData, page['cosmia-data'], customData);
    pageContext['cosmia-script'] = page['cosmia-script'];
    pageContext['cosmia-data'] = page['cosmia-data'];

    var canonicalPath = path.join('/', page.path.replace(pagesDir, '') + '.html');

    //ideally, everything should be an index.html file in the end
    //if it's not, we'll leave the full path in the canonical url
    if (/^index.html$/.test(path.basename(canonicalPath))) {
        canonicalPath = canonicalPath.replace(path.basename(canonicalPath), '');
    }

    pageContext['page-path'] = canonicalPath;

    var pageLayoutName = (pageContext.layout ? pageContext.layout : 'default');
    var compiledPage = handlebars.compile(page.content);
    var pageBody = compiledPage(pageContext);

    if (handlebarsLayouts[pageLayoutName] === undefined && !silent) {
        console.warn(PACKAGE_NAME + ": " + chalk.yellow("WARNING: Layout") + " `" + pageLayoutName + "` " + chalk.yellow("not found. Using") + " `default` " + chalk.yellow('instead.'));
        pageLayoutName = 'default';
    }

    var layoutName = pageLayoutName;
    var templateData = null;
    pageContext['cosmia-template-data'] = {};
    //Iterate up the layout tree.
    //Child layouts override parent layout data
    do {
        templateData = handlebarsLayouts[layoutName]['cosmia-template-data'];
        pageContext['cosmia-template-data'] = Object.assign({}, (templateData ? templateData : {}), pageContext['cosmia-template-data']);
        layoutName = templateData && templateData.parent ? templateData.parent : false;
    } while (layoutName);

    templateData = pageContext['cosmia-template-data'];

    layoutName = pageLayoutName;

    do {
        pageBody = (handlebarsLayouts[layoutName]).compile(Object.assign({}, {
            body: pageBody
        }, pageContext));
        templateData = handlebarsLayouts[layoutName]['cosmia-template-data'];
        layoutName = templateData && templateData.parent ? templateData.parent : false;
    } while (layoutName);

    return pageBody;
}

function _compilePages(outputDir, silent = false) {
    return new Promise((resolve, reject) => {
        for (var p of keys(pageData)) {
            try {
                var pageBody = _compilePage(pageData[p], {}, silent);
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

function _setupCosmia(srcFolder, silent = false) {

    partialsDir = path.resolve(srcFolder, COSMIA_PARTIAL_PATH);
    dataDir = path.resolve(srcFolder, COSMIA_DATA_PATH);
    layoutsDir = path.resolve(srcFolder, COSMIA_LAYOUT_PATH);
    helpersDir = path.resolve(srcFolder, COSMIA_HELPERS_PATH);
    pagesDir = path.resolve(srcFolder, COSMIA_PAGES_PATH);


    return Promise.resolve()
        .then(() => {
            return _registerAppComponents().then(() => {
                if (!silent) {
                    console.log(chalk.blue(PACKAGE_NAME) + ': components registered');
                }
            });
        })
        .then(() => {
            return _processDirectory(pagesDir, EXTENSION_HBS, _processPage).then(() => {
                if (!silent) {
                    console.log(chalk.blue(PACKAGE_NAME) + ': data extracted');
                }
            });
        });

}

function _setup(srcFolder) {
    return _setupCosmia(srcFolder, true).catch((err) => {
        console.error(chalk.red(err));
    });
}

function _compileSite(distFolder) {
    return _compilePages(distFolder).catch((err) => {
        console.error(chalk.red(err));
    });
}

function _cosmia(srcFolder, distFolder) {
    _setup(srcFolder).then(() => {
        _compileSite(distFolder);
    });
}

_cosmia.setup = _setup;
_cosmia.compileSite = _compileSite;
_cosmia.compilePage = function (pageName, customData = {}) {
    return _compilePage(pageData[pageName], customData, true);
};

module.exports = _cosmia;
