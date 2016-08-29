#cosmia-core

cosmia-core is the build tool for cosmia, the Content Oriented System for the Management of Internet Applications

##What is it?

This tool can be thought of as a static site generator. Given a certain directory structure (see: `test/` folder)  containing a set of handlebars files (layouts, helpers, partials, and pages) and some data in json format, cosmia will compile that directory into a site and output it.

##Usage

`cosmia [-h | [<projectDirectory>] [<outputDirectory>]]`

By default, cosmia takes no arguments, and attempts to function on the current working directory. This assumes that there is an `src` directory. It will attempt to compile to an adjacent `dist` directory.

If a projectDirectory is passed, cosmia will search for the `src` folder within it. Again, files will be compiled to a `dist` folder adjacent to `src`.

If both a projectDirectory and an outputDirectory are passed, cosmia will look for `src` within the projectDirectory and compile to the outputDirectory.
