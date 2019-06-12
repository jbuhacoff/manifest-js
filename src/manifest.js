#!/usr/bin/env node

const yargs = require('yargs');

const execCommand = require('./exec');

// process.argv is ['node','manifest.js','<command>',...]
// we need a special case for exec command because yargs doesn't yet have a feature to slurp rest of command line w/o processing it:
var context = {};
var yargsArgs = [];
if( process.argv[2] === "exec" ) {
    yargsArgs = execCommand.processArgv(process.argv, context);
}
else {
    // normal case: yargs gets all the args
    // because we are using yargs.parse(...) below, we need to skip the first two which are [node,manifest.js]
    for(var i=2; i<process.argv.length; i++) {
        yargsArgs.push(process.argv[i]);
    }
}

const argv = yargs
    .scriptName('manifest')
    .command(require('./add'))
    .command(require('./branch'))
    .command(require('./checkout'))
    .command(require('./create'))
    .command(require('./delete'))
    .command(execCommand)
    .command(require('./init'))
    .command(require('./merge'))
    .command(require('./status'))
    .demandCommand()
    .strict()
    .parse(yargsArgs, context)
    .argv;

