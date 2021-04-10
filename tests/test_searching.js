let {QueryResult} = require('../lib/searching.js')



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

    for ( let qry of query_list ) {
        let QR = new QueryResult(qry)
        console.log(QR.query)
    }

}



// 


function all_tests_this_module() {
    run_with_new_queries()
}


module.exports = all_tests_this_module

if (process.mainModule.filename === __filename) {
    all_tests_this_module()
}

