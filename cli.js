#!/usr/bin/env node

'use strict';
let cosmia = require('./index');
let chalk = require('chalk');

let path = require('path');

let userArgs = process.argv.slice(2);
let sourceDirectory = path.resolve('src');
let outputDirectory = path.resolve('dist');


function printUsage() {
    console.log(chalk.blue('Usage') + ': cosmia [-h | [<projectDirectory>] [<outputDirectory>]]');
}

//main
(() => {
    if (userArgs.length > 2) {
        console.error(chalk.red('too many parameters'));
        printUsage();
        process.exitCode = 1;
        return;
    }
    if (userArgs.length === 1 && userArgs[0] === '-h'){
        printUsage();
        return;
    }

    if(userArgs.length > 0){
        sourceDirectory = path.resolve(userArgs[0], 'src');
        outputDirectory = path.resolve(userArgs[0], 'dist');
    }

    if(userArgs.length > 1){
        outputDirectory = path.resolve(userArgs[1]);
    }

    cosmia(sourceDirectory, outputDirectory);

})();
