

class SearchesByUser {
    //
    //
    constructor(SearchClass,owner,conf) {
                            // get_search
                            // clear
                            // add_just_one
                            // set_global_file_list_refs
        this.searches = new SearchClass(conf)       // crash if undefined
        //
        this.owner = owner
        //
        this.global_file_list = []
        this.global_file_list_by = { "create_date" : [], "update_date" : []}
        this.searches.set_global_file_list_refs(this.global_file_list,this.global_file_list_by)
        this.user_info = {}
    }


    set_user_info(info) {
        if ( info === undefined ) return
        this.user_info  = info
    }

    async run_op(op) {          // these are operations on the query...
        if ( op === undefined || (typeof op.cmd !== 'string' ) ) {
            return { "status" : "ERR" }
        }
        switch ( op.cmd ) {
            case "search" : {           // run the search
                if ( op.req === undefined ) {
                    return { "status" : "ERR" }
                }
                let req = op.req
                return await this.process_search(req)
            }
            case "remove" : {           // clear this search from memory
                if ( (op.req === undefined) || (op.req.body === undefined) ) {
                    return { "status" : "ERR" }
                }
                let req = op.req
                this.searches.clear(req.body.query)
                break
            }
            case "info" : {             // tell us about the user
                return({ "status" : "OK", "data" : JSON.stringify(this.user_info) })
            }
            case "item" : {             // retrieve a particular item....
                if ( (op.req === undefined) || (op.req.body === undefined) ) {
                    return { "status" : "ERR" }
                }
                if ( (typeof op.req.body.key !== 'string') || (typeof op.req.body.field !== 'string') ) {
                    return { "status" : "ERR" }
                }
                //
                let item
                let req = op.req
                let key = req.body.key
                let field = req.body.field
                //
                let linear = this.global_file_list_by["update_date"]
                let n = linear.length
                let start = 0
                for ( let i = start; i < n; i++ ) {
                    item = linear[i]
                    if ( item ) {
                        if ( item[field] === key ) {
                            return({ "status" : "OK", "data" : JSON.stringify(item) })
                        }
                    }
                }
            }
        }
        return({ "status" : "OK" })
    }

    async process_search(req) {
        if ( (typeof req.params === undefined) || (typeof req.params.query !== 'string') ) {
            return []
        }

        let query = req.params.query;
        try {
            //
            let box_count = parseInt(req.params.bcount);
            let offset = parseInt(req.params.offset);
            //
            let search_results = this.searches.get_search(query,offset,box_count);
            return(search_results)    
        } catch(e) {
            return []
        }
    }
    
    add_just_one(f_obj,is_new) {
        this.searches.add_just_one(f_obj,is_new)
    }
}







module.exports = SearchesByUser