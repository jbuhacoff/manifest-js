const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { execFileSync } = require('child_process');
const git = require('./vcs/git');
const libinfo = require('./lib/info');

/**
This function is invoked by the main script when the command is 'exec'.

argv: array of args (typically process.argv)
context: an object to populate with information as needed, which will be passed by yargs to the handler function below as part of its argv parameter
return value: new array to use as argv for further processing, possibly modified with more, less, or different items
*/
exports.processArgv = function(argv,context) {
    var yargsArgs = [];
    var execArgs = [];
    // yargs gets the 'exec' and one more to be the '<command>' parameter (if it is present):
    for(var i=2; i<=3 && i<process.argv.length; i++) {
        yargsArgs.push(process.argv[i]);
    }
    // the exec command gets everything after the <command> parameter (args to the command):
    for(var i=4; i<process.argv.length; i++) {
        execArgs.push(process.argv[i]);
    }
    context.execArgs = execArgs;
    return yargsArgs;
};

exports.command = 'exec <command>';
exports.describe = 'executes a command in each repository';
exports.builder = function (yargs) {
    return yargs.positional('command', {
        describe: 'to execute'
    });
};
exports.handler = function (argv) {
    // read the current manifest 
    var currentManifestName = libinfo.readCurrentManifestName();
    var content = libinfo.readManifestContent(currentManifestName);
    var repoList = Object.getOwnPropertyNames(content);
    // execute command in each repo and capture output
    var branchMap = {}; // repo => output
    for(var i=0; i<repoList.length; i++) {
        var repo = repoList[i];
        console.log("%s", repo);
        var filepath = repo;
//        var cmd = argv.execArgs.join(" "); // see manifest.js for special argv processing that populates execArgs
        try {
            branchMap[repo] = execFileSync(argv.command, argv.execArgs, { cwd: filepath }).toString();
        }
        catch(err) {
            branchMap[repo] = {status: err.status};
            if( err.stdout ) { branchMap[repo].stdout = err.stdout.toString(); }
            if( err.stderr) { branchMap[repo].stderr = err.stderr.toString(); }
        }
    }
    // print output
    for(var i=0; i<repoList.length; i++) {
        var repo = repoList[i];
        console.log("# "+repo);
        if( typeof branchMap[repo] === "string" ) {
            console.log("\n```\n"+branchMap[repo]+"\n```\n");
        }
        else {
            console.log("\nError:\n```\n"+JSON.stringify(branchMap[repo])+"\n```\n");
        }
    }
};
