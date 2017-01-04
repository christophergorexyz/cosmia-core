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

const COSMIA_PARTIAL_PATH = 'partials';
const COSMIA_CONFIG_PATH = 'config';
const COSMIA_HELPERS_PATH = 'helpers';
const COSMIA_SITE_PATH = 'components';

const PACKAGE_NAME = chalk.blue('cosmia-core');

var siteData = {};
var handlebarsLayouts = {};
var pageData = {};

var partialsDir = '';
var configDir = '';
var helpersDir = '';
var siteDir = '';

//read all the files of a given type in a directory and execute a process on their content
//the processor takes the form function (name, content){ ... }
/*function _processDirectory(dirName, extension, processor) {
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
}*/

function _processDirectory(dirName, processor) {
    return new Promise((resolve, reject) => {
        recursiveReaddir(dirName, (err, files) => {
            if (err) {
                reject(err);
                return;
            }
            files.forEach((filename) => {
                var nameWithoutExtension = path.resolve(path.dirname(filename), path.basename(filename, path.extname(filename)));
                var fileContent = fs.readFileSync(path.resolve(dirName, filename), 'utf8');
                try {
                    processor(nameWithoutExtension, fileContent);
                } catch (err) {
                    reject(err);
                    return;
                }

            });

            return resolve();
        });
    });
}

function _registerConfigFile(name, content) {
    var splitPath = name.replace(configDir + '/', '').split('/');
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

function _registerHelperFile(name, content) {
    handlebars.registerHelper(require(path.resolve(name)));
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

//TODO: probably wise to hold onto this for reference for the moment, and reuse for nested components
/*function _registerLayoutFile(name, content) {
    var layout = {
        content: content,
        path: name
    };
    layout = _extractCustomPageElement(layout, COSMIA_TEMPLATE_DATA, (e) => JSON.parse(DomUtils.getInnerHTML(e)));
    layout.compile = handlebars.compile(layout.content);
    handlebarsLayouts[path.basename(name)] = layout;
}*/


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

function _processSite(name, content) {
    var page = {
        path: name,
        content: content
    };

    var keyName = path.join('.', name.replace(siteDir, ''));
    pageData[keyName] = page;
}

function _setupCosmia(srcFolder, silent = false, customData = {}) {

    partialsDir = path.resolve(srcFolder, COSMIA_PARTIAL_PATH);
    configDir = path.resolve(srcFolder, COSMIA_CONFIG_PATH);
    helpersDir = path.resolve(srcFolder, COSMIA_HELPERS_PATH);
    siteDir = path.resolve(srcFolder, COSMIA_SITE_PATH);

    return Promise.resolve()
        .then(() => {
            handlebars.registerHelper(require('handlebars-helpers')());
            return Promise.all([
                _processDirectory(configDir, EXTENSION_JSON, _registerConfigFile),
                _processDirectory(partialsDir, EXTENSION_HBS, _registerPartialFile),
                _processDirectory(helpersDir, EXTENSION_JS, _registerHelperFile)
            ]).then(() => {
                if (!silent) {
                    console.log(chalk.blue(PACKAGE_NAME) + ': components registered');
                }
            });
        })
        .then(() => {
            return _processDirectory(siteDir, EXTENSION_HBS, _processSite).then(() => {
                siteData = Object.assign({}, siteData, customData);
                if (!silent) {
                    console.log(chalk.blue(PACKAGE_NAME) + ': data extracted');
                }
            });
        });
}

function _setup(srcFolder, customData = {}) {
    return _setupCosmia(srcFolder, true, customData).catch((err) => {
        console.error(chalk.red(err));
    });
}

function _compileSite(distFolder) {
    return _compilePages(distFolder).catch((err) => {
        console.error(chalk.red(err));
    });
}

function _cosmia(srcFolder, distFolder, customData = {}) {
    return _setup(srcFolder, customData).then(() => {
        _compileSite(distFolder);
    });
}

_cosmia.setup = _setup;
_cosmia.compileSite = _compileSite;
_cosmia.compilePage = function (pageName, customData = {}) {
    return _compilePage(pageData[pageName], customData, true);
};

module.exports = _cosmia;
