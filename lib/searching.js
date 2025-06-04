//
const {Registry} = require('copious-registry')
const {FileOperationsCache} = require('extra-file-class')
//
const {QueryResult} = require('./defaut_queries.js')
//

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

/**
 * Searching
 */
class Searching extends Registry {
    //
    constructor(conf,QueryInterfaceClass) {
        //
        super(conf)
        //
        this.functional_evaluator = false
        if ( conf.functional_evaluator !== undefined ) {
            try {
                this.functional_evaluator = require(conf.functional_evaluator)
            } catch (e) {
                console.log(e)
            }
        }
        //
        this.fos = new FileOperationsCache(conf)
        //
        this.local_active_searches = {}
        //
        this.shrinkage = conf.shrinkage
        this.backup_file = conf.search_backup_file
        //
        this.identifier_key = "_tracking"
        if ( conf.repo_id_field ) {
            this.identifier_key = conf.repo_id_field
        }
        //
        this.safe_locked_file = false
        //
        this.QInterfaceClass = ((QueryInterfaceClass !== undefined) ? QueryInterfaceClass : QueryResult)
        //
        this._search_functions = {}
        if ( typeof conf.search_function_table === 'object' ) {
            this._search_functions = conf.search_function_table
            for ( let ky in this._search_functions ) {
                let ff = this._search_functions[ky]
                if ( typeof ff !== 'function' ) {
                    delete this._search_functions[ky]
                }
            }
        }
    }


    /**
     * 
     * @param {*} query 
     * @returns 
     */
    query_hasher(query) {
        if ( typeof this.hasher === 'function' ) {
            let s = query.trim()
            return this.hasher(s)
        }
        return "nothing"
    }


    /**
     * set_query_interface_class
     * 
     * Changes the query parsing and match control class.
     * Caution should be used. Most likely a user interface will be using a syntax that complies with 
     * another query parser. It may be best to expand on existing classes in use if not planning an overhaul 
     * to user interfaces.
     * 
     * @param {string} class_module 
     */
    set_query_interface_class(class_module) {
        try {
            this.QInterfaceClass = require(class_module)
        } catch (e) {
            console.log(e)
        }
    }


    /**
     * get_search
     * 
     * Givent that a query has run, this method returns retuns some part of the data it keeps.
     * The query is found in the table of queries (ones already run) by the query string 
     * that acts as its key.
     * 
     * Expects the query to return a descriptor (determined by the query class)
     * 
     * For example:
     * 
     * 
     ```{
            "data" : returned_data,  // the current small bucket set of data to fit the user view
            "length" : returned_data.length,
            "offset" : offset,
            "count" : count         // number of possible results to view
        }
    ```
     * 
     * @param {string} query 
     * @param {integer} offset - offset into the data list (start of data to be returned)
     * @param {integer} box_count - the number of elements to be returned
     * @returns object
     */
    async get_search(query,offset,box_count) {
        let qry = this.get_query(query)
        if ( qry ) {
            let data_descr = qry.access(offset,box_count)
            return data_descr
        }
        return []
    }


    /**
     * get_query
     * @param {object} query 
     * @returns array
     */
    async get_query(query) {
        let qhash = await this.query_hasher(query)
        let qry_instance = this.local_active_searches[qhash]
        if ( qry_instance !== undefined ) {
            return qry_instance
        } else {
            let q_obj= await this.run_query(query)
            if ( q_obj === false ) {
                return false
            }
            this.local_active_searches[qhash] = q_obj        // THE NORMALIZED QUERY ACTS ACTS AS A KEY TO THE QUERY OBJECT
            return q_obj
        }
    }



    /**
     * 
     * run_query
     * 
     * creates new queries and then runs it agains the loaded index already in store.
     * 
     * Hands query parsing to the QInterfaceClass
     * Return the query object and the query string.
     * 
     * The data found by the query (refs) is attached to the query object in a list.
     * 
     * @param {string} query 
     * @returns Pair<QueryClass,string> 
     */
    async run_query(query) {
        let q = new this.QInterfaceClass(query,this.functional_evaluator)
        let [match_text,orderby] = q.parts()
        let data = this._run_query(match_text,orderby,q)
        if ( data.length ) {
            q.set_data(data)
            return q    
        }
        return false
    }


    search_one_all_files(field,match_text) {
        let list = this.global_file_list.ordering_table()["update_date"]  // return an iterable
        for ( let item of list ) {
            if ( item[field] ===  match_text ) {
                return [ item ]
            }
        }
        return []
    }


    search_by_field_all_files(field,match_text) {
        let results = this.global_file_list.filter((ob) => {
            return obj[field] === match_text
        })
        return results
    }

    search_by_function_all_files(funcdef) {
        let results = this.global_file_list.filter((obj) => {
            return funcdef(obj)
        })
        return results
    }


    /**
     * attempt_join_searches
     * 
     * Attempts to run the query on the new object to see if it can be added to query result lists.
     * 
     * injest an element into searchs... look at all the searches and add it to the query list calling q.inject
     * 
     * @param {*} f_obj 
     */
    attempt_join_searches(f_obj) {
        let searches = this.local_active_searches
        for ( let query in searches ) {
            let q = searches[query]
            let [match_text,orderby] = q.parts()
            if ( match_text !== 'any' ) {
                if ( this.good_match(f_obj,match_text) ) { // good match write a score to f_obj
                    q.inject(f_obj,orderby)
                }
            } else {
                q.inject(f_obj,orderby)
            }
        }
    }

    
    // MATCHING....
    // implement in descendant
    score_match(check_txt,q_list,mult) {
        let score = 1.0
        return(score*mult)
    }
    
    good_match(f_obj,match_text,qry) {
        return(true)
    }
    // END OF MATCHING....



    // _run_query
    _run_query(match_text,orderby,qry) {
        //
        let results = false
        //
        if ( match_text === 'any' ) {
            // returns everything sorted according to the parameter or a default creation date
            // these are pre-sorted
            results = this.from_all_files(orderby)  
            //
        } else if ( orderby === 'subQ' ) {
            let [sqry_match_text,intendedOrderBy] = qry.sub_query()
            let sqry = this.get_query(sqry_match_text) // runs the master query if needed (e.g. emails belonging to someone@example.com)
            if ( sqry ) {
                if ( typeof sqry._run_query === 'function' ) {  // this way if the query is a searcher
                    return sqry._run_query(match_text,intendedOrderBy,sqry)  // run the detailed query on the master query results
                } else { // If the query is a file list (of the type outlined by `registry` )
                    if ( this.locked_data_swap(sqry) ) {   // for a short while make the master query the list of everyone
                        let results = this._run_query(match_text,intendedOrderBy,sqry)  // use this searcher to run the detailquery
                        this.unlocked_data_swap()    // put our data back
                        return results
                    }
                    return []  // just didn't work this time.
                }
            }
        } else if ( qry.op_is_special_id_key(orderby) ) {
            // For exact matches. Pull from the pre-sorted by filtering
            results = this.search_one_all_files(this.identifier_key,match_text)
            //
        } else if ( qry.op_is_special_key(orderby) ) {
              // query can indicate the field to match on
            let field = qry.special_key(orderby)
            results = this.search_by_field_all_files(field,match_text)
            //
        } else if ( qry.op_is_function(orderby) ) {
            let func = qry.op_get_function(match_text)
            if ( func ) {
                results = this.search_by_function_all_files(func)
            }
        } else if ( qry.op_is_stored_function(orderby) ) {  // fuctions loaded at startup.
            let func = this._search_functions[match_text]
            if ( func ) {
                results = this.search_by_function_all_files(func)
            }
        } else {
            //
            try {
                //
                let self = this
                results = this.global_file_list.filter((object) => {
                    return self.good_match(object,match_text,qry)
                })
                //
                switch ( orderby ) {
                    case 'update_date' :  {
                        results = this.sort_by_updated(results)
                        break;
                    }
                    case 'score' : {
                        results = this.sort_by_score(results)
                        break;
                    }
                    case 'create_date' :
                    default: {
                        results = this.sort_by_created(results)
                        break;
                    }
                }
            } catch(e) {
                console.log(e)
                return([])  // something went wrong... so nothing
            }
        }
        //  // results is an array object (basic javascript)
        if ( results.length ) {
            // don't create copies... keep a index for the viewer.. but ref the object fix it on delivery
            results = results.map((item,index)=> {
                let c_item = {
                    "entry" : index + 1,
                    "score" : item.score,
                    "item_ref" : item
                }
                return(c_item)
            })
        }
        //
        if ( qry.is_aggregation() ) {
            let aggregate_results = this.aggregate(results,qry)
            return aggregate_results
        }
        //
        return results      // the list of matching items
    }


    /**
     * 
     * @param {*} data 
     * @param {*} qry 
     * @returns 
     */
    aggregate(data,qry) {
        let func = false
        if ( qry.aggregate_is_code() ) {
            func = qry.op_get_function(match_text)
        } else {
            let funcname = qry.aggregate_function_id()
            func = this._search_functions[funcname]
            if ( func === undefined ) {
                return data
            }
        }
        let initial_value = qry.initial_aggregate()
        let reduction = data.reduce(func,initial_value)
        return {
            'data' : data,
            'aggr' : reduction
        }
    }


    ///

    /**
     * prune
     * 
     * @param {number} delta_timeout 
     * @returns number - the number of items pruned.
     * 
     */
    prune(delta_timeout) {
        //
        let prune_time = Date.now()
        //
        let searches = Object.keys(this.local_active_searches)
        //
        let count = 0
        searches.forEach(srch => {
            let q_obj = this.local_active_searches[srch]
            let when = q_obj.when
            if ( (prune_time - delta_timeout) > when ) {
                let q = this.local_active_searches[srch]
                q.clear()
                delete this.local_active_searches[srch]
                count++
            }
        })
        //
        return count
    }


    /// FILES
    // ----
    /**
     * backup_searches
     * @param {boolean} do_halt -- indicates if the program is shutting down
     */
    async backup_searches(do_halt) {
        console.log("backing up searches")
        //
        let backup_serials = {}
        for ( let qry in this.local_active_searches ) {
            let QR = this.local_active_searches[qry]
            backup_serials[qry] = QR.serialize()
        }
        //
        let status = await this.fos.output_json(this.backup_file,backup_serials)
        if ( status === false ) {
            if ( do_halt === true ) {
                console.log("halting ... done backing up searches")
                console.log("exiting")
                process.exit(0)
            }
        }
    }


    /**
     * restore_searches
     * 
     * load the searches that were previously save to the configured backup file
     */
    async restore_searches() {
        console.log("restoring searches")
        try {
            //
            this.local_active_searches = {}
            let stored_obj = await this.fos.load_json_data_at_path(this.backup_file)
            //
            for ( let k in stored_obj ) {
                let restored = stored_obj[k]
                let q = new this.QInterfaceClass('',this.functional_evaluator,restored)
                q.deserialize(this.get_global_tracking_map())
                this.local_active_searches[k] = q
            }
            //
        } catch (e) {
            console.log(e)
        }
    }


    /**
     * clear
     * 
     * Wipes out a query
     * 
     * @param {string} query 
     */
    async clear(query) {
        let qhash = await this.query_hasher(query)
        let q = this.local_active_searches[qhash]
        if ( q ) {
            q.clear()
            delete this.local_active_searches[qhash]
        }
    }


    // ---- ---- ---- ---- ---- ---- ---- ---- ----
    /**
     * app_specific_file_removal
     * 
     * Note: tracking and `_id` differ in that tracking may be used across a number of search applications.
     * `_id` may be a user id an will key into individual searches in a search instance.
     * 
     * @param {string} tracking -- the tracking field string, should be attached to the objet
     * @param {object} stored - an object that has been found in the global file list and is being removed
     */
    app_specific_file_removal(tracking,stored) {
        //
        let statics = this.QInterfaceClass
        let individual_search = statics.individual_search_key(tracking,this.identifier_key)
        let q = this.local_active_searches[individual_search]
        if ( q !== undefined ) {
            delete this.local_active_searches[individual_search]
        }
        if ( stored._id !== undefined ) {{
            let id_search = statics.id_search_key(stored._id)
            q = this.local_active_searches[id_search]
            if ( q !== undefined ) {
                delete this.local_active_searches[id_search]
            }
        }}
        //
    }

    /**
     * get_special_key_query
     * 
     * @param {string} matcher 
     * @param {string} id_key 
     * @returns string
     */
    get_special_key_query(matcher,id_key) {
        let statics = this.QInterfaceClass
        return statics.individual_search_key(matcher,id_key)
    }

    /**
     * get_special_id_query
     * 
     * @param {string} id 
     * @returns string
     */
    get_special_id_query(id) {
        let statics = this.QInterfaceClass
        return statics.id_search_key(id)
    }

    /**
     * get_special_function_query
     * 
     * @param {string} func_def 
     * @returns string
     */
    get_special_function_query(func_def) {
        let statics = this.QInterfaceClass
        return statics.function_key(func_def)
    }

    /**
     * get_special_function_key
     * 
     * @param {string} func_key 
     * @returns string
     */
    get_special_function_key_query(keyed_func_name) {
        let statics = this.QInterfaceClass
        return statics.keyed_function_key(keyed_func_name)
    }



    locked_data_swap(data_view) {
        if ( this.safe_locked_file !== false ) {
            this.registry_waits()
            this.safe_locked_file = this.global_file_list
            this.global_file_list = data_view
            return true
        } 
        return false
    }

    unlocked_data_swap() {
        if ( this.safe_locked_file ) {
            this.global_file_list = this.safe_locked_file
            this.registry_runs()
        }
    }

}




module.exports.Searching = Searching
