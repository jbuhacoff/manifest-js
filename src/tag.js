const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const git = require('./vcs/git');
const libinfo = require('./lib/info');

exports.command = 'tag <name>';
exports.describe = 'tag each repository';
exports.builder = function (yargs) {
    return yargs.positional('name', {
        describe: 'new tag name',
        type: 'string'
    })
};
exports.handler = function (argv) {
    if( !fs.existsSync(".manifest/ref") ) {
        console.error("directory not found: .manifest/ref");
        process.exit(1);
    }
    if( !fs.existsSync(".manifest/current") ) {
        console.error("file not found: .manifest/current");
        process.exit(1);
    }

    var vcsMap = {git}; 

    // read the current manifest
    var currentManifestName = libinfo.readCurrentManifestName();
    var content = libinfo.readManifestContent(currentManifestName);
    var repoList = Object.getOwnPropertyNames(content);


    // check that we can operate on each repository (NOTE: code duplicated in status.js, merge.js, branch.js, and update.js)
    var isVcsPluginAvailable = true;
    for(var i=0; i<repoList.length; i++) {
        var repo = repoList[i];
        // determine vcs plugin for each repo if it's not specified
        if( !content[repo].vcs ) {
            var info = libinfo.getRepositoryInfo(repo);
            if( info.vcs ) {
                content[repo].vcs = info.vcs;
            }
        }
        // do we have the plugin?
        if( !vcsMap[content[repo].vcs] ) {
            console.error("vcs module not found: %s", content[repo].vcs);
            isVcsPluginAvailable = false;
        }
    }
    if( !isVcsPluginAvailable ) {
        process.exit(1);
    }

    // tag branch name in each repository
    for(var i=0; i<repoList.length; i++) {
        var repo = repoList[i];
        var plugin = vcsMap[content[repo].vcs];
        try {
            plugin.createTag(repo, argv.name);
        }
        catch( err ) {
            console.error("failed to create tag in %s", repo);
        }
    }
};
