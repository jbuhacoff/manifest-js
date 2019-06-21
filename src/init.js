const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const libinfo = require('./lib/info');
const cmdcreate = require('./create');
const git = require('./vcs/git');
const https = require('https');
const cmdcheckout = require('./checkout');

function processManifest(name) {
    // Read manifest to get a list of repositories
    var content = libinfo.readManifestContent(name);
    var repoList = Object.getOwnPropertyNames(content);
    var vcsMap = {git};
    
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
    
    console.log("Created manifest: %s", name);
    
    // Clone each repository to the workspace
    var branchMap = {}; // repo => output
    for(var i=0; i<repoList.length; i++) {
        var repo = repoList[i];
        var plugin = vcsMap[content[repo].vcs];
        try {
            console.log("Cloning %s from %s", repo, content[repo].url);
            branchMap[repo] = plugin.clone(repo, content[repo].url);
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
    console.log("---\ntitle: Init report for: "+name+"\n---\n");
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
    
}

exports.command = 'init <url>';
exports.describe = 'initialize a workspace';
exports.builder = function (yargs) {
    return yargs.positional('url', {
        describe: 'of manifest'
    })
};
exports.handler = function (argv) {
    if( fs.existsSync('.git')) {
        console.error('.git folder exists in cwd. Remove to continue.')
        process.exit(1);
    }
    if( argv.url === "." ) {
        if( fs.existsSync(".manifest") ) {
            console.error(".manifest already exists");
            process.exit(1);
        }
        fs.mkdirSync(".manifest");
        fs.mkdirSync(".manifest/ref");
        cmdcreate.handler({name:"main"});
    }
    else {
        if( fs.existsSync(".manifest") ) {
            console.error(".manifest already exists");
            process.exit(1);
        }
        // Create .manifest directory tree
        fs.mkdirSync(".manifest");
        fs.mkdirSync(".manifest/ref");

        // Trim full URL down to name and extension
        var fullManifestPath = argv.url;
        var fullManifestName = fullManifestPath.replace(/^.*[\\\/]/, '');

        if( fullManifestPath.endsWith('/')) {
            currentManifestName = "main";
        }
        else {
            currentManifestName = path.parse(fullManifestName).name;   // Slice extension, regardless of length
        }

        // Create manifest.yaml file from URL contents
        var manifestFile = fs.createWriteStream(".manifest/ref/"+currentManifestName+".yaml");
        var request = https.get(fullManifestPath, function(response) {
            response.on('data', (contentYaml) => {
                fs.writeFileSync(".manifest/ref/"+currentManifestName+".yaml", contentYaml);
                libinfo.writeCurrentManifestName(currentManifestName);
                processManifest(currentManifestName);
                // Checkout each repository
                cmdcheckout.handler({ref:currentManifestName});
            });
        });
    }
};