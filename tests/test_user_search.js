let {Searching} = require('../lib/searching.js')
let {uuid,sleeper,qnd_assert,dump_test_results} = require('./helpers.js')
//
let SearchesByUser = require('../lib/single_owner_searches')

//

async function test_search_by_user_class() {
    let conf =  {
        shrinkage : 1.0,
        search_backup_file : "./test_u_search.json"
    }
    //
    let u_searcher = new SearchesByUser(Searching,"john@doo.com",conf)

    let info = {
        "name" : "John Doe",
        "date" : Date.now()
    }
    u_searcher.set_user_info(info)
    //

    qnd_assert((u_searcher.user_info.name === "John Doe"),__function)



    let track_nums = []
    let guesswork = []
    for ( let i = 0; i < 15; i++ ) {
        let u = uuid()
        track_nums.push(u)
        let r = Math.random()
        guesswork.push(r)
        let f_obj = { "_tracking" : u, "r" : `${r}` }
        u_searcher.add_just_one(f_obj,true)
    }

    qnd_assert((u_searcher.user_info.name === "John Doe"),__function)

    let req = {
        'params' : {
            'query' : "all|create_date",
            'bcount' : 2,
            'offset' : 1
        },
        'body' : {
            'query' : "all|create_date"
        }
    }

    //
    let op = {
        'cmd' : "search",
        'req' : req
    }
    u_searcher.run_op(op)

    //
    op = {
        'cmd' : "remove",
        'req' : req
    }
    u_searcher.run_op(op)

    //
    op = {
        'cmd' : "info"
    }
    u_searcher.run_op(op)

    op = {
        'cmd' : "item",
        'req' : {
            "body" : {
                "key" : '' + guesswork[Math.floor(Math.random()*15)],
                "field" : "r"
            }
        }
    }
    let item_pack = await u_searcher.run_op(op)
    console.log(item_pack)
    //
    qnd_assert((item_pack.status === "OK"),__function)
    let object = JSON.parse(item_pack.data)
    
    qnd_assert((object.r === op.req.body.key),__function)

}


async function all_tests_this_module() {
    await test_search_by_user_class()
}


module.exports = all_tests_this_module

if ( require.main.filename === __filename ) {
    //
    (async () => {
        await all_tests_this_module()
        console.log("test_user_searches")
        dump_test_results()    
    })()
    //
}





