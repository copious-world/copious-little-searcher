

/**
 * SearchesByUser
 * 
 */
class SearchesByUser {
    //
    //
    constructor(searcher,owner) {
        this.searches = searcher // use the application searcher, but keep the queries that are special to this user
        this.owner = owner
        //
        this.local_active_searches = {}
        this.user_info = {}
        //
    }


    set_user_info(info) {
        if ( info === undefined ) return
        this.user_info = info
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
                this.clear(req.body.query)
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



    /**
     * get_search -- the same search as in `searching.js`. But, manages queries for a particular user
     * 
     * @param {string} query 
     * @param {integer} offset - offset into the data list (start of data to be returned)
     * @param {integer} box_count - the number of elements to be returned
     * @returns object
     */
    async get_search(query,offset,box_count) {
        let qhash = await this.searches.query_hasher(query)
        //
        //  try to find a search a query result object for this query
        //
        let qry_instance = this.local_active_searches[qhash]
        if (  qry_instance !== undefined  ) {
            let data_descr = qry_instance.access(offset,box_count)
            return data_descr
        } else {
            // could not find one so create a new one...
            let q_obj = await this.searches.run_query(query)  // THE DIFFERENCE
            if ( q_obj === false ) return []
            else {
                this.local_active_searches[qhash] = q_obj        // THE NORMALIZED QUERY ACTS ACTS AS A KEY TO THE QUERY OBJECT
                let data_descr = q_obj.access(offset,box_count)
                return data_descr    
            }
        }
    }

    
    async clear(query) {
        let qhash = await this.searches.query_hasher(query)
        let q = this.local_active_searches[qhash]
        if ( q ) {
            q.clear()
            delete this.local_active_searches[qhash]
        }
    }


    /**
     * process_search
     * 
     * @param {object} req - a request object made available by the HTTP processing
     * @returns Array - query results or empty
     */
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
            let search_results = this.get_search(query,offset,box_count);
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

