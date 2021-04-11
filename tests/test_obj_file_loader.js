
let {uuid,sleeper,qnd_assert,dump_test_results} = require('./helpers.js')
let ObjFileDirLoader = require('../lib/object_file_loader')


async function test_ObjFileDirLoader() {
    let a_list = []

    let resolver = false
    let p = new Promise((resolve,reject) => {
        resolver = () => {resolve()}
    })
    let file_count = 2
    let ofl = new ObjFileDirLoader('./faux',a_list,() => {
        console.log(a_list.length)
        resolver()
    })
    ofl.noisy = true
    ofl.load_directory()

    await p
    
    qnd_assert((a_list.length === file_count),__function)
}


async function all_tests_this_module() {
    await test_ObjFileDirLoader()
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





