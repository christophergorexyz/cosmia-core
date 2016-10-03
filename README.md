# cosmia-core 

cosmia-core is the build tool for cosmia, the Content Oriented System for the Management of Internet Applications 


## What is it? 

This tool can be thought of as a simple static site generator. Given a certain directory structure (see: `test/` folder)  containing a set of handlebars files (layouts, helpers, partials, and pages) and some data in json format, cosmia will compile that directory into a site and output it. 


## CLI Usage 

`cosmia [-h | [<projectDirectory>] [<outputDirectory>]]` 

By default, cosmia takes no arguments, and attempts to function on the current working directory. This assumes that there is an `src` directory in the current working directory. It will attempt to compile to an adjacent `dist` directory. 

If a projectDirectory is passed, cosmia will search for the `src` folder within it. Again, files will be compiled to a `dist` folder adjacent to `src`. 

If both a projectDirectory and an outputDirectory are passed, cosmia will look for `src` within the projectDirectory and compile to the given outputDirectory. 

Passing the `-h` option will print this message. 


## API Usage 

Accessing cosmia's API directly is very similar to usage on the commandline. However it does not make any assumptions about the current working directory. Instead, directory paths must be supplied. cosmia exports a single function that takes two arguments, srcFolder and distFolder. 

```js
let path = require('path');
let cosmia = require('cosmia-core');

let srcFolder = path.resolve('./src');
let distFolder = path.resolve('./dist');

cosmia(srcFolder, distFolder);

```

Alternatively, you can compile specific pages on demand: 

```js
let cosmia = require('cosmia-core');

cosmia.setup('./src').then(() => {
    let pageBody = cosmia.compilePage('sub-section/index');
});

```


## Roadmap 

Support for favored technology will be prioritized over broad support for every technology under the sun. 

1. Type support 
    - pagination 
    - sorting 
    - varying views 
1. DataStore Integration 
    - content versioning 
    - file system (git?) 
    - NoSQL store 
1. Proper test fixtures 
    - mocha probably 
