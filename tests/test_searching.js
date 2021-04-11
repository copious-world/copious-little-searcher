let {QueryResult,Searching} = require('../lib/searching.js')
let {uuid,sleeper,qnd_assert,dump_test_results} = require('./helpers.js')



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
    let tossed_count = 0
    for ( let i = 0; i < 100; i++ ) {
        let tossit = (Math.random() > 0.68)
        if ( tossit ) {
            tossed_count++
            test_data.push({ "update_date" : fake_date, "score" : Math.random(), "_tracking" : false, "_xxzz_removed" : true })
        } else {
            test_data.push({ "update_date" : fake_date, "score" : Math.random(), "_tracking" : uuid(), "_xxzz_removed" : false })
        }
        fake_date++
    }
    //
    let QR1 = new QueryResult("butter|score")
    test_data.forEach(el => {
        QR1.inject(el,"score")
    })

    let data = QR1.stored_data
    qnd_assert(is_sorted_by_score(data),__function)
    qnd_assert(test_data.length === data.length,__function)

    let QR2 = new QueryResult("butter")
    test_data.forEach(el => {
        QR2.inject(el,"update_date")
    })
    data = QR2.stored_data
    qnd_assert(is_sorted_by_date(data),__function)


    let results = QR1.access(10,10)
    qnd_assert((results.length <= 10),__function)

    results = QR2.access(10,10)
    qnd_assert((results.length <= 10),__function)


    console.log(tossed_count)
}

// 

async function test_searching_class() {

    //
    let conf =  {
        shrinkage : 1.0,
        search_backup_file : "./test_search.json"
    }

    let t_searcher = new Searching(conf)
    //  //
    let test_data = []
    let fake_date = Date.now()
    let fake_creation = Date.now()
    let tossed_count = 0
    for ( let i = 0; i < 100; i++ ) {
        let tossit = (Math.random() > 0.68)
        if ( tossit ) {
            tossed_count++
            test_data.push({ "creation_date" : fake_creation, "update_date" : fake_date, "score" : Math.random(), "_tracking" : false, "_xxzz_removed" : true })
        } else {
            test_data.push({ "creation_date" : fake_creation, "update_date" : fake_date, "score" : Math.random(), "_tracking" : uuid(), "_xxzz_removed" : false })
        }
        fake_date += 2
        fake_creation++
    }

    //
    let test_data_map = {}

    t_searcher.set_global_file_list_refs(test_data,test_data_map)
    t_searcher.update_global_file_list_quotes_by()

    // prove that they are sorted by dates...
    //

    await t_searcher.get_search("any|creation_date",5,4)
    await t_searcher.get_search("bugs|update_date",5,4)
    await t_searcher.backup_searches(false)

    let tmap = t_searcher.global_tracking_map

    await t_searcher.restore_searches()

    let all_q = t_searcher.local_active_searches
    let fail_count = 0
    for ( let qry in all_q ) {
        let QR = all_q[qry]
        let data = QR.stored_data
        for ( let ref of data ) {
            let tracking = ref.item_ref._tracking
            if ( !tracking ) { fail_count++; continue } 
            if ( tmap[tracking] === undefined ) fail_count++;
        }
    }

    qnd_assert(fail_count===0,__function)

    await sleeper(1)
    let possible_count = Object.keys(t_searcher.local_active_searches).length
    let count = t_searcher.prune(0)

    console.log(possible_count + "  " + count )
    qnd_assert(possible_count===count,__function)

    await t_searcher.restore_searches()
    let s_count = Object.keys(t_searcher.local_active_searches).length
    console.log(s_count + "  " + count )
    qnd_assert((s_count > 0),__function)

    t_searcher.clear("bugs|update_date")
    let b_count = Object.keys(t_searcher.local_active_searches).length
    console.log(b_count + "  " + count )
    qnd_assert((b_count < s_count),__function)

    //
    let track_nums = []
    for ( let i = 0; i < 5; i++ ) {
        let u = uuid()
        track_nums.push(u)
        let f_obj = { "_tracking" : u }
        t_searcher.add_just_one(f_obj,false)
    }
    //

    for ( let tnum of track_nums ) {
        t_searcher.remove_just_one(tnum)
    }
    qnd_assert(true,__function)
}


async function all_tests_this_module() {
    //
    run_with_new_queries()
    run_with_prepped_data()
    await test_searching_class()
    //
}


module.exports = all_tests_this_module

if ( require.main.filename === __filename ) {
    //
    (async () => {
        await all_tests_this_module()
        console.log("test_searching")
        dump_test_results()    
    })()
    //
}

