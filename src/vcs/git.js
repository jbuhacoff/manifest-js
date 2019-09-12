const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const cygwin = require('../lib/cygwin');
const libinfo = require('../lib/info');
const libgit = require('simple-git');
const deasync = require('deasync');
const Fault = require('../lib/fault');

exports.name = 'git';

const isWindows = process.platform.toLowerCase().startsWith("win");


/**
filepath - path to a directory; must be a directory
Returns true if the directory is likely to be a repository handled by this plugin.
The intent is to do a quick check to narrow down candidates before confirming
which one will handle it. 
For the Git plugin, this means looking for a ".git" subdirectory. If it's present,
the directory is likely to be a Git repository.
*/
exports.isRepoLikely = function(filepath) {
    const isGitPresent = fs.lstatSync(path.join(filepath,".git")).isDirectory();
    return isGitPresent;
};

// NOTE: where options includes cwd, but cwd doesn't exist, execFileSync throws an error about the command not found (ENOENT) even though the cwd is the problem
const execFileSyncWrapper = function(cmd,args,options)  {
    if(options.cwd) {
        if( !fs.existsSync(options.cwd) ) {
            throw new Fault({type:"file-not-found",path:options.cwd});
        }
        if( !fs.lstatSync(options.cwd).isDirectory() ) {
            throw new Fault({type:"file-not-directory",path:options.cwd});
        }    
    }
    if( isWindows ) {
        if( cygwin.isCygwin ) {
            return execFileSync(cmd,args,options);
        }
        else {
            // need to convert cwd (which we reference with forward slashes) to windows (with backslashes)
            if( options.cwd ) {
                options.cwd = options.cwd.replace(/\//g,path.sep);
            }
            return execFileSync(cmd,args,options);
        }
    }
    else {
        return execFileSync(cmd,args,options);
    }
};

/**
filepath - path to a directory; must be a directory
Returns true if the directory is a repository handled by this plugin.
The intent is to confirm this information.
For the Git plugin, this means looking for a ".git" subdirectory and checking that
there is a current commit. 
*/
exports.isRepo = function(filepath) {
    const isGitPresent = fs.lstatSync(path.join(filepath,".git")).isDirectory();
    if( !isGitPresent ) { return false; }
    const isGitCommit = execFileSyncWrapper("git",["rev-parse","HEAD"], { cwd: filepath }).toString();
    if( !isGitCommit ) { return false; }
    const toplevel = execFileSyncWrapper("git",["rev-parse","--show-toplevel"], { cwd: filepath} ).toString();
    if( cygwin.isCygwin ) {
        var winpath = cygwin.winpath(toplevel);
        var winpathrel = libinfo.toRelativePath(winpath);
        var filepathrel = libinfo.toRelativePath(filepath);
        if( winpathrel !== filepathrel ) { return false; }
    }
    else {
        if( toplevel !== filepath ) { return false; }
    }
    return true;
};

/**
url - url to a repository
Returns true if the URL is likely to represent a repository handled by this plugin.
For the Git plugin, this means looking for "git+ssh:" scheme at the start of the URL,
or looking for ".git" suffix at the end of the URL.
*/
exports.isUrl = function(url) {
    const lcUrl = url.toLowerCase();
    return lcUrl.startsWith("git+ssh:") || lcUrl.endsWith(".git");
}

/**
filepath - path to repository directory handled by this plugin
Returns the URL from which to clone the repository
for a Git repository we prefer to use "origin" if it is defined, otherwise use the first one.
NOTE: a Git repository may have a separate push URL (get it with `git remote get-url --push origin`) but we're not concerned
with that, because we just need to initialize the clone URL and after that it's up to the Git plugin to manage push etc.
*/
exports.getUrl = function(filepath) {
    var remote = "origin";
    var url;
    var remoteNameList = execFileSyncWrapper("git",["remote"], { cwd: filepath }).toString();
    var remoteNameArray = remoteNameList.split(/\r?\n/);
    if( remoteNameArray.length === 0 || remoteNameArray[0].length === 0 ) {
        return null;
    }
    if( !remoteNameArray.includes("origin") ) {
        remote = remoteNameArray[0];
    }
    url = execFileSyncWrapper("git",["remote","get-url",remote], { cwd: filepath }).toString().replace(/\r?\n$/,""); // output example: ssh://git.cryptium.net/loginshield-service-backend.git
    return url;
}

/*
filepath - path to a repository directory handled by this plugin
Return name of current reference (branch or commit)
*/
const getRef = function(filepath) {
    try {
        const branchRef = execFileSyncWrapper("git",["symbolic-ref","--short","HEAD"], { cwd: filepath }).toString().replace(/\r?\n$/,""); // or git rev-parse --abbrev-ref HEAD
        if( branchRef !== "HEAD" )  {
            return branchRef;
        }
        const commitRef = execFileSyncWrapper("git",["rev-parse","HEAD"], { cwd: filepath }).toString().replace(/\r?\n$/,"");
        return commitRef;
    }
    catch(e) {
        console.error("cannot get ref: %o", e);
        return "";
    }
};

exports.getRef = getRef;

///////////// TODO: refactor below functions as a factory method + methods on an object ; so that once a plugin is identified for a repository we can create an object o represent the combination of repository + plugin,  and that way we don't have to always call git.fn(repopath,otherargs) we can just call repoobject.fn(aotherargs).  all the following functions assume that filepath is to a valid repository of the appropraite type for this plugin.

/**
returns true if the branch name exists (locally or in any remote)
*/
exports.isBranchCreated = function(filepath,branchName) {
    try {
        const repo = libgit(filepath);
        const branchListSync = deasync(repo.branch.bind(repo));
        const branchSummary = branchListSync([]);
        return branchSummary.all.includes(branchName);
    }
    catch(e) {
        console.error("git.isBranchCreated error", e);
        throw e;
    }
};

/**
Creates the specified branch locally.
If branch name starts with '+', prepends current ref (branch name or commit) to create a branch name like '{current}+{name}'
*/
exports.createBranch = function(filepath,branchName) {
    try {
        const repo = libgit(filepath);
        var newName = branchName;
        if( branchName.startsWith('+') ) {
            var current = getRef(filepath);
            newName = current + branchName; // already includes the '+'
        }
        const branchCheckoutSync = deasync(repo.checkoutLocalBranch.bind(repo));
        const result = branchCheckoutSync(newName);
    }
    catch(e) {
        console.error("git.createBranch error", e);
        throw e;
    }
};


/**
Creates the specified branch locally.
If branch name starts with '+', prepends current ref (branch name or commit) to create a branch name like '{current}+{name}'
*/
exports.createTag = function(filepath,tagName) {
    try {
        const repo = libgit(filepath);
        const addTagSync = deasync(repo.addTag.bind(repo));
        const result = addTagSync(tagName);
    }
    catch(e) {
        console.error("git.createTag error", e);
        throw e;
    }
};

exports.getStatus = function(filepath) {
    var status = {};
    status.stdout = execFileSyncWrapper("git",["status"], { cwd: filepath }).toString();//.replace(/\r?\n$/,"");
    return status;
};

exports.checkout = function(filepath, vcsRef) {
    try {
        const repo = libgit(filepath);
        const checkoutSync = deasync(repo.checkout.bind(repo));
        const result = checkoutSync(vcsRef);
        return {stdout: "OK"};
    }
    catch(e) {
        console.error("git.checkout error", e);
        throw e;
    }
};

exports.merge = function(filepath, fromVcsRef) {
    try {
        const repo = libgit(filepath);
        const toVcsRef = getRef(filepath);
        const mergeSync = deasync(repo.mergeFromTo.bind(repo));
        const result = mergeSync(fromVcsRef, toVcsRef);
        return {stdout: result};
    }
    catch(e) {
        console.error("git.merge error", e);
        throw e;
    }
};

exports.clone = function(filepath, url) {
    try {
        const newRepo = libgit();
        const cloneSync = deasync(newRepo.clone.bind(newRepo));
        const result = cloneSync(url, filepath);
        return {stdout: result};
    }
    catch(e) {
        console.error("git.clone error", e);
        throw e;
    }
};