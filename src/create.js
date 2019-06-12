const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const libinfo = require('./lib/info');

/**
Input: path to file or directory
Output: true if a directory, false otherwise
*/
const isDirectory = function (filepath) {
    return fs.lstatSync(filepath).isDirectory();
};
/**
Input: path to directory
Output: array of immediate subdirectories (not recursive)
*/
const listDirectories = function (filepath) {
    return fs.readdirSync(filepath).map(name => path.join(filepath,name)).filter(isDirectory);
};
/**
Input: path to directory
Output: array of all subdirectories (depth-first search of directories under filepath)
*/
const listDirectoriesRecursive = function (filepath) {
    var subdirs = listDirectories(filepath);
    var result = [];
    for(var i=0; i<subdirs.length; i++) {
        result.push(subdirs[i]);
        result.push(...listDirectoriesRecursive(subdirs[i]));
    }
    return result;
};
/**
Input: path to directory
Output: array of all subdirectories (depth-first search of directories under filepath) that are Git repositories
*/
const listRepositoriesRecursive = function (filepath) {
    var subdirs = listDirectories(filepath);
    var isRepo = false;
    var result = [];
    for(var i=0; i<subdirs.length; i++) {
        if( path.parse(subdirs[i]).base === '.git' ) {
            isRepo = true;
            break;
        }
    }
    if( isRepo ) { return [ filepath ]; }
    // this directory is not a git repository, so check its subdirectories
    for(var i=0; i<subdirs.length; i++) {
        result.push(...listRepositoriesRecursive(subdirs[i]));
    }
    return result;
};



exports.command = 'create <name>';
exports.describe = 'create a new manifest with current state of workspace';
exports.builder = function (yargs) {
    return yargs.positional('name', {
        describe: 'of new manifest'
    })
};
exports.handler = function (argv) {
    if( !fs.existsSync(".manifest/ref") ) {
        console.error("directory not found: .manifest/ref");
        process.exit(1);
    }
    var content = {};
    var repoAbsolutePathList = listRepositoriesRecursive(process.cwd());
    const cwdLength = process.cwd().length;
    for( var i=0; i<repoAbsolutePathList.length; i++) {
        var repo = repoAbsolutePathList[i];
        var info = libinfo.getRepositoryInfo(repo);
        // repo path is absolute; convert to relative path from current directory, with forward slashes
        var path = repo.substr(cwdLength+1).replace(/\\/g,"/"); 
        content[path] = info;
    }
    libinfo.writeManifestContent(argv.name, content);
    libinfo.writeCurrentManifestName(argv.name);
};
