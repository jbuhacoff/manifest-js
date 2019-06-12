const fs = require('fs');
const { execFileSync } = require('child_process');

function isCygwinCheck() {
    const isWindows = process.platform.toLowerCase().startsWith("win");
    if( !isWindows ) { return {cygwin:false}; }
    // if we are running in cygwin there will be TERM environment variable and a /cygdrive directory
    if( process.env.TERM /*&& fs.existsSync("/cygdrive") && fs.lstatSync("/cygdrive").isDirectory()*/ ) {
        const cygpath = execFileSync("which",["cygpath"]);
        if( fs.existsSync("C:\\cygwin64\\bin\\cygpath.exe") ) {
            return {cygwin:true,cygpath:"C:\\cygwin64\\bin\\cygpath.exe",which:"C:\\cygwin64\\bin\\which.exe",bash:"C:\\cygwin64\\bin\\bash.exe"};
        }
        else {
            return {cygwin:true,cygpath:cygpath};
        }
    }
    return {cygwin:false};
};

const status = isCygwinCheck();

exports.isCygwin = status.cygwin;

exports.status = status;

/**
filepath - path to a directory like /path/to/dir
Returns the windows form, like C:\path\to\dir
*/
exports.winpath = function(filepath) {
   return execFileSync(status.cygpath,["-w",filepath]).toString().replace(/\r?\n$/,"");
};

/**
command - name of a command on the path, e.g. 'git'
Returns the windows path, like 'C:\cygwin64\bin\git.exe'.
This function is a shortcut to something like winpath( $("which git") )
*/
exports.winexepath = function(cmd) {
    var cmdpath = execFileSync(status.which,[cmd]).toString().replace(/\r?\n$/,"");
    return execFileSync(status.cygpath,["-w",cmdpath]).toString().replace(/\r?\n$/,"");
};
