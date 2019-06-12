const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const libinfo = require('./lib/info');

exports.command = 'delete <name>';
exports.describe = 'delete specified manifest';
exports.builder = function (yargs) {
    return yargs.positional('name', {
        describe: 'of manifest to delete'
    })
};
exports.handler = function (argv) {
    if( !fs.existsSync(".manifest/ref") ) {
        console.error("directory not found: .manifest/ref");
        process.exit(1);
    }
    var current = libinfo.readCurrentManifestName();
    if( current === argv.name ) {
        console.error("error: cannot delete current manifest");
        console.log("advice: switch to another manifest first");
        process.exit(1);
    }
    libinfo.deleteManifest(argv.name);
};
