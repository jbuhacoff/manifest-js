const fs = require('fs');
//const path = require('path');
const yaml = require('js-yaml');
const git = require('../vcs/git');

/**
filepath - path to a file or directory, either in windows style or posix style
Returns the path relative to the current directory in posix style
*/
exports.toRelativePath = function(filepath) {
    const cwd = process.cwd().replace(/\\/g, "/");
    const filepathFs = filepath.replace(/\\/g, "/");
    if( filepathFs.startsWith(cwd+"/") ) {
        return filepathFs.substr(cwd+1);
    }
    throw new Error("not relative to current directory: "+filepath);
};

/**
filepath - path to a directory (must exist, if does not exist or not a directory we return a fault)
Return object with repository attributes { ref, url, type } 
Ref is the current branch or commit 
Url is the url where the repository can be downloaded (if we can determine from the repository itself)
Type is the name of the plugin identified to handle actions on the repository (e.g. 'git')
*/
const getRepositoryInfo = function (filepath) {
    if(!filepath) {
        return {fault:{type:"invalid-parameter",message:"null",path:filepath}};
    }
    if( !fs.lstatSync(filepath).isDirectory() ) {
        return {fault:{type:"invalid-parameter",message:"not a directory",path:filepath}};
    }
    // identify which plugin will handle the repository in two steps: 1) short list, 2) confirm
    var plugin;
    const pluginList = [git]; // all available plugins
    // make the short list of candidate plugins
    var pluginCandidateList = [];
    for(var i=0; i<pluginList.length; i++) {
        if( pluginList[i].isRepoLikely(filepath) ) {
            pluginCandidateList.push(pluginList[i]);
        }
    }
    // confirm a candidate from the short list
    for(var i=0; i<pluginCandidateList.length; i++) {
        if( pluginCandidateList[i].isRepo(filepath) ) {
            plugin = pluginCandidateList[i];
            break;
        }
    }
    // cannot continue if we didn't find one
    if( !plugin ) {
        return {fault:{type:"unknown-repo-type",path:filepath}};
    }
    // find the repository url
    const url = plugin.getUrl(filepath);
    // find the current reference (branch or commit)
    const ref = plugin.getRef(filepath);
    return { url, ref, vcs: plugin.name };
};

exports.readCurrentManifestName = function() {
    const currentFileContent = fs.readFileSync(".manifest/current").toString().replace(/\r?\n$/,"");
    return currentFileContent;
};

exports.readManifestContent = function(name) {
    const content = fs.readFileSync(".manifest/ref/"+name+".yaml").toString();
    return yaml.safeLoad(content);
};

exports.writeManifestContent = function(name,contentObject) {
    fs.writeFileSync(".manifest/ref/"+name+".yaml", yaml.safeDump(contentObject));
};

exports.writeCurrentManifestName = function(name) {
    fs.writeFileSync(".manifest/current", name);
};

exports.deleteManifest = function(name) {
    fs.unlinkSync(".manifest/ref/"+name+".yaml");
}

exports.getRepositoryInfo = getRepositoryInfo;
