const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const git = require('./vcs/git');
const libinfo = require('./lib/info');

exports.command = 'branch <name>';
exports.describe = 'create a new branch in each repository';
exports.builder = function (yargs) {
    // console.log(yargs);
    return yargs.positional('name', {
        describe: 'new branch name'
    })
    .option('create', {
        describe: 'create a new manifest of the same name'
    })
};
exports.handler = function (argv) {
    if( typeof argv.name !== "string" ) {
        console.error("not a vald branch name: %s", argv.name);
        process.exit(1);
    }
    var vcsMap = {git}; 
    // read the current manifest
    var currentManifestName = libinfo.readCurrentManifestName();
    var content = libinfo.readManifestContent(currentManifestName);
    var repoList = Object.getOwnPropertyNames(content);
    // check that we can operate on each repository (NOTE: code duplicated in status.js and merge.js)
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

    // compute new branch name in each repo
    var branchMap = {}; // repo => new branch name
    var isBranchCreated = false;
    // check that new branch name does not already exist in any repo
    for(var i=0; i<repoList.length; i++) {
        var repo = repoList[i];
        var plugin = vcsMap[content[repo].vcs];
        if( plugin.isBranchCreated(repo, argv.name) ) {
            console.error("branch already exists in repository: %s", repo);
            isBranchCreated = true;
        }
    }
    if( isBranchCreated ) {
        process.exit(1);
    }
    // create a branch in each repo and switch to it
    for(var i=0; i<repoList.length; i++) {
        var repo = repoList[i];
        var plugin = vcsMap[content[repo].vcs];
        plugin.createBranch(repo, argv.name);
    }

    // Create manifest file if --create flag is used
    if( argv.create === true) {
        var newBranchName = argv.name;
        if( newBranchName.startsWith('+')) {
            newManifestName = currentManifestName.concat(newBranchName);
        }
        else {
            newManifestName = newBranchName;
        }
        libinfo.writeCurrentManifestName(newManifestName);
        libinfo.writeManifestContent(newManifestName, content);
        console.log(newManifestName);
    }
};
