
let {uuid,sleeper,qnd_assert,dump_test_results} = require('./helpers.js')
let DirWatcherHandler = require('../lib/directory_watch_handler.js')

const fs = require('fs')

class TestManager {

    //
    constructor() {

    }

    add_just_one(fobj) {
        console.dir(fobj)
    }

    remove_just_one(elem_id) {
        console.log("remove_just_one: " + elem_id)
    }

}

let sim_files = [
    [ "write", "./dyno_faux/test_file1.json", JSON.stringify({
        "test" : 1, "value" : "something to say"
    }) ],
    [ "write", "./dyno_faux/test_file2.json", JSON.stringify({
        "test" : 2, "value" : "butter finger winger dinger"
    }) ],
    [ "remove", "./dyno_faux/test_file1.json" ],
    [ "write", "./dyno_faux/test_file3.json", JSON.stringify([
        {"test" : 3, "value" : "sploppy doppy longer gone" },
        {"test" : 4, "value" : "cat bread dog food tomato"},
        {"test" : 5, "value" : "please keep this out of reach"},
        {"test" : 6, "value" : "put it next to the hand"},
        {"test" : 7, "value" : "wild things"},
        {"test" : 8, "value" : "how but the gill of the fish with a wish"}
    ]) ],
    [ "remove", "./dyno_faux/test_file2.json" ],
    [ "sleep", 2 ],
    [ "remove", "./dyno_faux/test_file3.json" ]
]


function file_changes() {
    let next_op = sim_files.shift()
    if ( next_op !== undefined ) {
        try {
            let path = next_op[1]
            if ( next_op[0] === "write" ) {
                let data = next_op[2]
                fs.writeFileSync(path,data)
            } else  if ( next_op[0] === "remove" ) {
                fs.unlinkSync(path)
            } else if ( next_op[0] === "sleep" ) {
                sleeper(parseInt(path))
            }
        } catch (e) {
        }
    }
}

async function test_DirWatcherHandler() {
    let element_manager = new TestManager()
    let dwh = new DirWatcherHandler("./dyno_faux",element_manager)
    dwh.start()
    let resolver = () => {}
    let p = new Promise((resolve,reject) => {
        resolver = () => { resolve(true) }
    })
    let intrvl = setInterval(file_changes,200)
    setTimeout(() => {
        clearInterval(intrvl)
        resolver()
    },5000)
    await p
}


async function all_tests_this_module() {
    await test_DirWatcherHandler()
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





