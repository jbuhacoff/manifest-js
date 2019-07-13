const fs = require('fs');
const path = require('path');
const url = require('url');
const yaml = require('js-yaml');
const libinfo = require('./lib/info');
const cmdcreate = require('./create');
const cmdcheckout = require('./checkout');
const git = require('./vcs/git');
const https = require('https');

const isYamlFile = function (filepath) {
    return fs.lstatSync(filepath).isFile() && filepath.endsWith(".yaml");
};

const listYamlFiles = function (filepath) {
    return fs.readdirSync(filepath).map(name => path.join(filepath,name)).filter(isYamlFile);
};

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

function initWithRemoteManifestFile(url) {
    // Trim full URL down to name and extension
    var fullManifestPath = url;
    var fullManifestName = fullManifestPath.replace(/^.*[\\\/]/, '');

    if( fullManifestPath.endsWith('/')) {
        currentManifestName = "main";
    }
    else {
        currentManifestName = path.parse(fullManifestName).name;   // Slice extension, regardless of length (e.g. "main.yaml" => "main")
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

// urlString is the url of the git repository, e.g. https://example.com/path/to/manifest.git
// ref is the optional tag or branch in the repository to checkout, e.g. "projectname"; default value is "master", or not to do a checkout at all after cloning the repository 
function initWithRemoteGitRepository(urlString, ref) {
    
    // get repository name from url
    const urlObject = url.parse(urlString);
    var repo = path.basename(urlObject.pathname, ".git");
    
    // git clone <url>
    var result;
    try {
        // if the repository is not present, clone it first
        if( !fs.existsSync(repo) ) {
            console.log("Cloning %s from %s", repo, urlString);
            result = git.clone(repo, urlString);
        }
        if( result.error || result.fault || !fs.existsSync(repo) ) {
            console.error("Error: clone failed: %s", urlString);
            return;
        }
        // if a tag or branch was specified, then do a checkout, else expect manifest repository to have initial manifest files in master branch
        if( ref ) {
            result = git.checkout(repo, ref);
            if( result.error || result.fault ) {
                console.error("Error: cannot checkout %s", ref);
                return error;
            }
        }
        // there should be some files <repo>/*.yaml to copy into .manifest/ref
        var yamlFiles = listYamlFiles(repo);
        for(var i=0; i<yamlFiles.length; i++) {
            var targetPath = path.join(".manifest","ref",path.basename(yamlFiles[i]));
            fs.copyFileSync(yamlFiles[i], targetPath);
        }
    }
    catch(e) {
        if( e.name === 'Fault' ) {
            result = {fault:e.info};
        }
        else {
            result = {fault:{type:e.name,message:e.message}};
        }
    }
    if( result.error || result.fault ) {
        console.error("manifest init failed: %o", result);
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
        console.error('found .git folder in workspace')
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
        
        // is url to a .git repository?
        if( argv.url.endsWith(".git") ) {
            initWithRemoteGitRepository(argv.url);
        }
        else {
            initWithRemoteManifestFile(argv.url);
        }

    }
};