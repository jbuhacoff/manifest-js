const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const libinfo = require('./lib/info');
const cmdcreate = require('./create');

exports.command = 'init <url>';
exports.describe = 'initialize a workspace';
exports.builder = function (yargs) {
    return yargs.positional('url', {
        describe: 'of manifest'
    })
};
exports.handler = function (argv) {
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
        console.log("TODO: init with url: %s", argv.url);
        process.exit(1);
    }
};
