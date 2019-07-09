const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { execFileSync } = require('child_process');
const git = require('./vcs/git');
const libinfo = require('./lib/info');

exports.command = 'checkout <ref>';
exports.describe = 'checkout the branch or commit from each repository in the specified manifest';
exports.handler = function (argv) {
    // read the target manifest
    var currentManifestName = libinfo.readCurrentManifestName();
    var content = libinfo.readManifestContent(argv.ref);
    var repoList = Object.getOwnPropertyNames(content);
    var vcsMap = {git}; 
    // check that we can operate on each repository of current manifest (NOTE: code duplicated in branch.js and status.js)
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
    // change current manifest name
    libinfo.writeCurrentManifestName(argv.ref);
    // execute checkout command in each repo and capture output
    var branchMap = {}; // repo => output
    for(var i=0; i<repoList.length; i++) {
        var repo = repoList[i];
        var plugin = vcsMap[content[repo].vcs];
        var fromRef = content[repo].ref;
        try {
            // if the repository is not present, clone it first
            if( !fs.existsSync(repo) ) {
                console.log("Cloning %s from %s", repo, content[repo].url);
                branchMap[repo] = plugin.clone(repo, content[repo].url);
            }
            branchMap[repo] = plugin.checkout(repo, fromRef);
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
    console.log("---\ntitle: Checkout report for: "+argv.ref+"\n---\n");
    for(var i=0; i<repoList.length; i++) {
        var repo = repoList[i];
        console.log("# "+repo);
        console.log("\n```\n"+branchMap[repo].stdout+"\n```\n");
    }
};
