const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { execFileSync } = require('child_process');
const git = require('./vcs/git');
const libinfo = require('./lib/info');

exports.command = 'status';
exports.describe = 'prepares a status report';
exports.handler = function (argv) {
    // read the current manifest
    var currentManifestName = libinfo.readCurrentManifestName();
    var content = libinfo.readManifestContent(currentManifestName);
    var repoList = Object.getOwnPropertyNames(content);
    var vcsMap = {git}; 
    // check that we can operate on each repository (NOTE: code duplicated in branch.js and merge.js)
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
    // execute status command in each repo and capture output
    var branchMap = {}; // repo => output
    for(var i=0; i<repoList.length; i++) {
        var repo = repoList[i];
        var plugin = vcsMap[content[repo].vcs];
        try {
            branchMap[repo] = plugin.getStatus(repo);
        }
        catch(e) {
            if( e.name === 'Fault' ) {
                branchMap[repo] = {fault:e.info};
            }
            else {
                branchMap[repo] = {fault:{type:e.name,message:e.message}};
            }
        }
    }
    // print output
    console.log("---\ntitle: Manifest status report for: "+currentManifestName+"\n---\n");
    for(var i=0; i<repoList.length; i++) {
        var repo = repoList[i];
        console.log("# "+repo);
        if( branchMap[repo].stdout ) {
            console.log("\nstdout:\n```\n"+branchMap[repo].stdout+"\n```\n");
        }
        if( branchMap[repo].stderr ) {
            console.log("\nstderr:\n```\n"+branchMap[repo].stderr+"\n```\n");
        }
        if( branchMap[repo].fault ) {
            console.log("\nfault:\n```\n"+yaml.safeDump(branchMap[repo].fault)+"\n```\n");
        }
    }
};
