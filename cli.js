#!/usr/bin/env node

'use strict';
let cosmia = require('./index');
let chalk = require('chalk');

let path = require('path');

let userArgs = process.argv.slice(2);
let sourceDirectory = path.resolve('src');
let outputDirectory = path.resolve('dist');


function printUsage() {
    console.log(chalk.blue('Usage') + ': cosmia [-h | [<projectDirectory>] [<outputDirectory>]]\n');

    console.log('By default, cosmia takes no arguments, and attempts to function on the current working directory. This assumes that there is an `src` directory in the current working directory. It will attempt to compile to an adjacent `dist` directory.\n');

    console.log('If a projectDirectory is passed, cosmia will search for the `src` folder within it. Again, files will be compiled to a `dist` folder adjacent to `src`.\n');

    console.log('If both a projectDirectory and an outputDirectory are passed, cosmia will look for `src` within the projectDirectory and compile to the given outputDirectory.\n');

    console.log('Passing the `-h` option will print this message.\n');
}

//main
(() => {
    if (userArgs.length > 2) {
        console.error(chalk.red('too many parameters'));
        printUsage();
        process.exitCode = 1;
        return;
    }
    if (userArgs.length === 1 && userArgs[0] === '-h') {
        printUsage();
        return;
    }

    if (userArgs.length > 0) {
        sourceDirectory = path.resolve(userArgs[0], 'src');
        outputDirectory = path.resolve(userArgs[0], 'dist');
    }

    if (userArgs.length > 1) {
        outputDirectory = path.resolve(userArgs[1]);
    }

    cosmia(sourceDirectory, outputDirectory);

})();
