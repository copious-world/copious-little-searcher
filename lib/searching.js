//
const {Registry} = require('copious-registry')
const {FileOperationsCache} = require('extra-file-class')
//
const {QueryResult} = require('./lib/defaut_queries')
//

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

const SPECIAL_KEY_LENGTH = '_zz_srch_X_field:'.length
const SPECIAL_KEY_NAME = '_zz_srch_X_field:'

const SPECIAL_FUNC_KEY_LENGTH = '_zz_srch_X_func..'.length
const SPECIAL_FUNC_KEY_NAME = '_zz_srch_X_func..'

const SPECIAL_KEYED_FUNC_KEY_LENGTH = '_zz_srch_X_keyed_func..'.length
const SPECIALL_KEYED_FUNC_KEY_NAME = '_zz_srch_X_keyed_func..'


const SPECIAL_ID_KEY_NAME = '_zz_srch_X_id'


class Searching extends Registry {
    //
    constructor(conf,QueryInterfaceClass) {
        //
        super(conf)
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


    //  creats new queries
    async run_query(query) {
        let q = new this.QInterfaceClass(query)
        let [match_text,orderby] = q.query.split('|')
        let data = this._run_query(match_text,orderby)
        if ( data.length ) {
            q.set_data(data)
            return [q,q.query]    
        }
        return [false,false]
    }


    async get_search(query,offset,box_count) {
        //
        //  try to find a search a query result object for this query
        //
        let result = this.local_active_searches[query]
        if (  result !== undefined  ) {
            let data_descr = result.access(offset,box_count)
            return data_descr
        } else {
            // could not find one so create a new one...
            let [q_obj, normalized_query] = await this.run_query(query)
            if ( q_obj === false ) return []
            else {
                this.local_active_searches[normalized_query] = q_obj        // THE NORMALIZED QUERY ACTS ACTS AS A KEY TO THE QUERY OBJECT
                let data_descr = q_obj.access(offset,box_count)
                return data_descr    
            }
        }
    }



    search_one_all_files(field,match_text) {
        let list = this.global_file_list_by["update_date"]  // return an iterable
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
        let results = this.global_file_list.filter((ob) => {
            return funcdef(obj)
        })
        return results
    }

    // attempt_join_searches
    // injest an element into searchs... look at all the searches and add it to the query list calling q.inject
    attempt_join_searches(f_obj) {
        let searches = this.local_active_searches
        for ( let query in searches ) {
            let q = searches[query]
            let [match_text,orderby] = q.query.split('|')
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
    
    good_match(f_obj,match_text) {
        return(true)
    }
    // END OF MATCHING....



    // _run_query
    _run_query(match_text,orderby) {

        let results = false

        if ( match_text === 'any' ) {
            //
            results = this.from_all_files(orderby)
            //
        } else if ( orderby === SPECIAL_ID_KEY_NAME ) {
            //
            results = this.search_one_all_files(this.identifier_key,match_text)
            //
        } else if ( orderby.substr(0,SPECIAL_KEY_LENGTH) === SPECIAL_KEY_NAME ) {
            //
            let field = orderby.substr(SPECIAL_KEY_LENGTH)
            results = this.search_by_field_all_files(field,match_text)
            //
        } else if ( orderby.substr(0,SPECIAL_FUNC_KEY_LENGTH) === SPECIAL_FUNC_KEY_NAME ) {
            let funcdef
            try {
                eval(match_text)
                results = this.search_by_function_all_files(funcdef)
            } catch (e) {}
        } else if ( orderby.substr(0,SPECIAL_KEYED_FUNC_KEY_LENGTH) === SPECIALL_KEYED_FUNC_KEY_NAME ) {
            let func = this._search_functions[match_text]
            if ( func ) {
                results = this.search_by_function_all_files(funcdef)
            }
        } else {
            //
            try {
                //
                results = this.global_file_list.filter((object) => {
                    return this.good_match(object,match_text)
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
        return results      // the list of matching items
    }


    ///

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


    async restore_searches() {
        console.log("restoring searches")
        try {
            //
            this.local_active_searches = {}
            let stored_obj = await this.fos.load_json_data_at_path(this.backup_file)
            //
            for ( let k in stored_obj ) {
                let restored = stored_obj[k]
                let q = new this.QInterfaceClass('',restored)
                q.deserialize(this.global_tracking_map)
                this.local_active_searches[k] = q
            }
            //
        } catch (e) {
            console.log(e)
        }
    }


    clear(query) {
        let q = this.local_active_searches[query]
        if ( q ) {
            q.clear()
            delete this.local_active_searches[query]
        }
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ----
    app_specific_file_removal(tracking,stored) {
        //
        let individual_search = `${tracking}|_zz_srch_X_field:_tracking`
        let q = this.local_active_searches[individual_search]
        if ( q !== undefined ) {
            delete this.local_active_searches[individual_search]
        }
        if ( stored._id !== undefined ) {{
            let id_search = `${stored._id}|${SPECIAL_ID_KEY_NAME}`
            q = this.local_active_searches[id_search]
            if ( q !== undefined ) {
                delete this.local_active_searches[id_search]
            }
        }}
        //
    }

    //
}



module.exports.Searching = Searching
