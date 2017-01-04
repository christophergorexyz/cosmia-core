'use strict';

import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp'; //like `mkdir -p`
import keys from 'lodash.keys';
import recursiveReaddir from 'recursive-readdir';
import handlebars from 'handlebars';
import chalk from 'chalk';

const EXTENSION_HBS = '.hbs';
const EXTENSION_JSON = '.json';
const EXTENSION_JS = '.js';

const COSMIA_PARTIAL_PATH = 'partials';
const COSMIA_CONFIG_PATH = 'config';
const COSMIA_HELPERS_PATH = 'helpers';
const COSMIA_SITE_PATH = 'components';

const PACKAGE_NAME = chalk.blue('cosmia-core');

var partialsDir = '';
var configDir = '';
var helpersDir = '';
var siteDir = '';

var pageData = {};
var configData = {};


function _registerConfigFile(name, content) {
    var splitPath = name.replace(configDir + '/', '').split('/');
    var treeNode = configData;
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


function _registerPages(name, content){
    var splitPath = name.replace(siteDir + '/', '').split('/');
    var treeNode = pageData;
    var objectName = '';
    var dataObject = JSON.parse(content);
    while(splitPath.length){
        objectName = splitPath.shift();
        treeNode[objectName] = splitPath.length ? Object.assign({}, treeNode[objectName]) : dataObject;
        treeNode = treeNode[objectName];
    }
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
            return _processDirectory(siteDir, EXTENSION_JSON, _registerPages).then(() => {
                configData = Object.assign({}, configData, customData);
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

_cosmia.setup = _setup;
_cosmia.compileSite = _compileSite;
_cosmia.compilePage = function (pageName, customData = {}) {
    return _compilePage(pageData[pageName], customData, true);
};

module.exports = _cosmia;
