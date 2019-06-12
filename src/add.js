const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const libinfo = require('./lib/info');

exports.command = 'add <path>';
exports.describe = 'add a repository';
exports.builder = function (yargs) {
    return yargs.positional('path', {
        describe: 'relative path to repository'
    })
};
exports.handler = function (argv) {
    if( typeof argv.path !== "string" || !fs.lstatSync(argv.path).isDirectory() ) {
        console.error("not a directory: %s", argv.path);
        process.exit(1);
    }
    // we need the path parameter to be relative to current directory (the manifest root directory)
    var relpath, npath;
    const cwd = process.cwd();
    if( path.isAbsolute(argv.path) ) {
        npath = path.normalize(argv.path);
    }
    else {
        npath = path.normalize(path.join(cwd,argv.path));
    }
    if( !npath.startsWith(cwd+path.sep) ) {
        console.error("not in workspace: %s", argv.path);
        process.exit(1);
    }
    relpath = npath.substr(cwd.length+1).replace(/\\/g,"/");
    var info = libinfo.getRepositoryInfo(npath);
    console.log("add relpath = %s", relpath);
    // read existing manifest, add new content, and write edited manifest
    var currentManifestName = libinfo.readCurrentManifestName();
    var content = libinfo.readManifestContent(currentManifestName);
    if( content[relpath] ) {
        console.error("directory already in manifest: %s", relpath);
        process.exit(1);
    }
    content[relpath] = info;
    libinfo.writeManifestContent(currentManifestName, content);
};
