
function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
       var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
       return v.toString(16);
    });
 }

function sleeper(secs) {
    return new Promise((resolve,reject) => {
        setTimeout(() => { resolve(secs) },secs*1000)
    })
}

//
let g_passes = {}
let g_fails = {}


function qnd_assert(bval,func) {
    if ( g_passes[func] === undefined ) {
        g_passes[func] = 0
        g_fails[func] = 0
    }

    g_passes[func] += bval ? 1 : 0
    g_fails[func] += bval ? 0 : 1
}


function setup_global() {
    // FROM STACK EXCHANGE
    Object.defineProperty(global, '__stack', {
        get: function() {
                var orig = Error.prepareStackTrace;
                Error.prepareStackTrace = function(_, stack) {
                    return stack;
                };
                var err = new Error;
                Error.captureStackTrace(err, arguments.callee);
                var stack = err.stack;
                Error.prepareStackTrace = orig;
                return stack;
            }
        });
        
        Object.defineProperty(global, '__line', {
        get: function() {
                return __stack[1].getLineNumber();
            }
        });
        
        Object.defineProperty(global, '__function', {
        get: function() {
                return __stack[1].getFunctionName();
            }
    });
}


function dump_test_results() {
    console.log("PASSES:")
    console.dir(g_passes)
    console.log("FAILS:")
    console.dir(g_fails)
}

setup_global()
//

module.exports.uuid = uuid
module.exports.sleeper = sleeper
module.exports.qnd_assert = qnd_assert
module.exports.dump_test_results = dump_test_results
