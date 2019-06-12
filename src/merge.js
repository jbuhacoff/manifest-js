const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { execFileSync } = require('child_process');
const git = require('./vcs/git');
const libinfo = require('./lib/info');

exports.command = 'merge <ref>';
exports.describe = 'merge each repository from the specified manifest into the current one';
exports.handler = function (argv) {
    // read the current manifest
    var currentManifestName = libinfo.readCurrentManifestName();
    var content = libinfo.readManifestContent(currentManifestName);
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
    var currentManifestContent = content;
    var currentRepoList = repoList;
    // check that we can operate on each repository of 'from' manifest (NOTE: code duplicated in branch.js and status.js)
    content = libinfo.readManifestContent(argv.ref);
    repoList = Object.getOwnPropertyNames(content);
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
    var fromManifestContent = content;
    var fromRepoList = repoList;
    var currentNotFoundRepoList = [];
    // check if the 'from' manifest has any repositories that the 'current' manifest does not
    for(var i=0; i<fromRepoList.length; i++) {
        var fromRepo = fromRepoList[i];
        if( !currentRepoList.includes(fromRepo) ) {
            currentNotFoundRepoList.push(fromRepo);
        }
    }
    var fromRepoMap = {}; // repo path in 'from' manifest => repo path in 'current' manifest
    for(var i=0; i<currentNotFoundRepoList.length; i++) {
        var fromRepo = currentNotFoundRepoList[i];
        var fromUrl = fromManifestContent[fromRepo].url;
        const isMatch = function(a,b) { return a !== null && b !== null && a === b; };
        for(var j=0; j<currentRepoList.length; j++) {
            var currentMatchRepo = currentRepoList[j];
            var currentMatchUrl = currentManifestContent[currentMatchRepo].url;
            if( isMatch(fromUrl, currentMatchUrl) ) {
                fromRepoMap[fromRepo] = currentMatchRepo;
            }
        }
    }
    // add any repositories for which we did not find a match
    var currentManifestEdited = false;
    for(var i=0; i<currentNotFoundRepoList.length; i++) {
        var fromRepo = currentNotFoundRepoList[i];
        var currentMatch = fromRepoMap[fromRepo];
        if( !currentMatch ) {
            currentManifestContent[fromRepo] = fromManifestContent[fromRepo];
            currentManifestEdited = true;
        }
    }
    // store the updated manifest
    if( currentManifestEdited ) { 
        libinfo.writeManifestContent(currentManifestName, currentManifestContent);
    }
    
    // execute merge command in each repo and capture output
    var branchMap = {}; // repo => output
    for(var i=0; i<fromRepoList.length; i++) {
        var fromRepo = fromRepoList[i];
        var toRepo;
        if( fromRepoMap[fromRepo] ) {
            toRepo = fromRepoMap[fromRepo];
        }
        else {
            toRepo = fromRepo;
        }
        var plugin = vcsMap[currentManifestContent[toRepo].vcs];
        var fromRef = fromManifestContent[fromRepo].ref;
        branchMap[toRepo] = plugin.merge(toRepo, fromRef);
    }
    // print output
    console.log("---\ntitle: Merge report: "+argv.ref+" => "+currentManifestName+"\n---\n");
    for(var i=0; i<fromRepoList.length; i++) {
        var fromRepo = fromRepoList[i];
        if( fromRepoMap[fromRepo] ) {
            toRepo = fromRepoMap[fromRepo];
        }
        else {
            toRepo = fromRepo;
        }
        console.log("# "+toRepo);
        console.log("\n```\n"+branchMap[toRepo].stdout+"\n```\n");
    }
};
