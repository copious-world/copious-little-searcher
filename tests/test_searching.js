let {QueryResult} = require('../lib/searching.js')


let g_passes = {}
let g_fails = {}

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
    
function qnd_assert(bval,func) {
    if ( g_passes[func] === undefined ) {
        g_passes[func] = 0
        g_fails[func] = 0
    }

    g_passes[func] += bval ? 1 : 0
    g_fails[func] += bval ? 0 : 1
}



function is_sorted_by_score(elems) {
    let n = elems.length
    let prev_score = elems[0].item_ref.score
    for ( let i = 0; i < n; i++ ) {
        let score = elems[i].item_ref.score
        if ( score > prev_score ) return(false)
        prev_score = score
    }
    return(true)
}



function is_sorted_by_date(elems) {
    let n = elems.length
    let prev_ud = elems[0].item_ref.update_date
    for ( let i = 0; i < n; i++ ) {
        let ud = elems[i].item_ref.update_date
        if ( ud > prev_ud ) return(false)
        prev_ud = ud
    }
    return(true)
}




// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//
function run_with_new_queries() {

    let query_list = [
        "any",
        "cat | update_date",
        `  ${encodeURIComponent("some stuff > that | | |  can make sense")} |  update_date    `,
        `  ${encodeURIComponent("that can't make sense")} |  score`,
        `${encodeURIComponent("what ? can't | |    |  make sense ||")} |  create_date`,
        `what >= 3945739| |  ()  |  has sense || |  update_date   `,
        `${encodeURIComponent("what ? can't | |    |  make sense ||")} |  other`
    ]

    let results = [
        "any|create_date",
        "cat|update_date",
        "some stuff > that can make sense|update_date",
        "that can't make sense|score",
        "what ? can't make sense|create_date",
        "what >= 3945739 () has sense|update_date",
        "what ? can't make sense|other",
    ]

    let n = query_list.length
    for ( let i = 0; i < n; i++ ) {
        let qry = query_list[i]
        let QR = new QueryResult(qry)
        qnd_assert((QR.query === results[i],"run_with_new_queries"),__function)
    }

    let qry = query_list[0]
    let QR = new QueryResult(qry)
    
    QR.set_data([,1,2,3,4,5,6,7])
    QR.clear()
    qnd_assert(QR.stored_data.length === 0,__function)
}


function run_with_prepped_data() {
    let test_data = []
    let fake_date = Date.now()
    for ( let i = 0; i < 100; i++ ) {
        test_data.push({ "update_date" : fake_date, "score" : Math.random() })
        fake_date++
    }
    //
    let QR = new QueryResult("butter|score")
    test_data.forEach(el => {
        QR.inject(el,"score")
    })

    let data = QR.stored_data
    qnd_assert(is_sorted_by_score(data),__function)
    qnd_assert(test_data.length === data.length,__function)

    QR = new QueryResult("butter")
    test_data.forEach(el => {
        QR.inject(el,"update_date")
    })
    data = QR.stored_data
    qnd_assert(is_sorted_by_date(data),__function)
}

// 


function all_tests_this_module() {
    run_with_new_queries()
}


module.exports = all_tests_this_module

if ( require.main.filename === __filename ) {
    //
    all_tests_this_module()
    run_with_prepped_data()

    console.log("PASSES:")
    console.dir(g_passes)
    console.log("FAILS:")
    console.dir(g_fails)
    //
}

