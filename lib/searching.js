const fsPromises = require('fs/promises')


class QueryResult {

    // The constructor has two modes. One is for a new query. The other is for a query that is being restored from disk.
    constructor(query,restore) {
        this.original_query = query // for record keeping
        if ( restore === undefined ) {
            let normalized_query = this.normalize_query(query)
            this.stored_data = []  // will be set later
            this.query = normalized_query
            this.when = Date.now()
        } else {
            this.stored_data = restore.stored_data
            this.query = restore.query
            this.when = Date.now()
        }
    }

    // set_data
    //      store the data that matched the query stored in the instance of this class
    set_data(data) {        // keep the query results
        this.stored_data = data
    }

    // clear
    //      throw data away.
    clear() {
        this.stored_data = []
    }


    // normalize_query
    // This method expects a single parameter, the original search query string with a specific format.
    // This method uses the two part string in order to generate a querh easily used by _run_query in descendens of searching.
    // The query format expected is a two part string with a shef separator '|' The left side of the separator must be a 
    // url encoded list of key words separated by spaces. When it is decoded, the key words will be separated by spaces.
    // The second part specifies an ordering. The stored data objects are expeceted to have a date object field containg two fields,
    // one for updated and the other for created (creation date).   A field 'score' is expected as part of the objects stored in the 
    // data arrays. As such:
    //  {
    //      'score' : <number>,
    //      'dates' { 'create_date' : <number>, 'update_date' : <number> }
    //  }

    normalize_query(query_descr_str) {
        let orderby = 'create_date'
        let match_text = 'any'

        query_descr_str = query_descr_str.trim()
        try {
            let qparts = query_descr_str.split("|")
            qparts = qparts.map(apart => { return apart.trim() })
            match_text = decodeURIComponent(qparts[0])
            orderby = qparts[1]
        } catch (e) {
            console.log(e)
            return(false);
        }

        if ( match_text === 'any' || match_text === "" ) {  // only got the second part (ordering) 'any|something' or '|something'
            if ( [ 'update_date', 'score', 'create_date'].indexOf(orderby) < 0 ) {
                orderby = 'create_date'
                query_descr_str = `${match_text}|create_date`
            }
        }

        if ( (orderby === undefined) ||  (orderby.length === 0) ) {
            orderby = 'create_date'
        }

        switch ( orderby ) {
            case 'update_date' :  {
                query_descr_str = `${match_text}|update_date`
                break;
            }
            case 'score' : {
                query_descr_str = `${match_text}|score`
                break;
            }
            case 'create_date' : {
                query_descr_str = `${match_text}|create_date`
                break;
            }
            default: {
                orderby = orderby.trim()
                query_descr_str = `${match_text}|${orderby}`
                break;
            }
        }

        return(query_descr_str)
    }


    //  access
    //  Returns a slice of the data array which was created in response to finding matches to the query 
    //  belonging to this class. Updates the timestamp for recent use.
    access(offset,box_count) {
        //
        this.when = Date.now()
        //
        let n = this.stored_data.length
        offset = Math.min(n,offset)

        let returned_data = this.stored_data.slice(offset,offset + box_count)
        let count = this.stored_data.length

        let removals = []
        returned_data = returned_data.map((item_holder,index) => {
            if ( (item_holder.item_ref._tracking === false) && (item_holder.item_ref._xxzz_removed === true) ) {
                removals.push((offset + index))
                return null
            }
            let out = Object.assign({},item_holder.item_ref)
            out.entry = item_holder.entry            
            return out
        })

        if ( removals.length ) {
            returned_data = returned_data.filter(item => {
                return (item !== null)
            })
            while ( removals.length > 0 ) {
                let index = removals.pop()
                if ( index < this.stored_data.length ) {
                    this.stored_data.splice(index,1)
                }
            }
        }

        return {
            "data" : returned_data,  // the current small bucket set of data to fit the user view
            "length" : returned_data.length,
            "offset" : offset,
            "count" : count         // number of possible results to view
        }
    }



    inject(f_obj,ordering) {
        //
        let ref = {
            "entry" : this.stored_data.length,
            "item_ref" : f_obj
        }
        if ( ordering === 'score' ) {
            let score = f_obj.score
            let n = this.stored_data.length
            let inserted = false
            for ( let i = 0; i < n; i++ ) {
                let oref = this.stored_data[i]
                let test_obj = oref.item_ref
                if ( test_obj.score < score ) {
                    this.stored_data.splice(i,0,ref)
                    inserted = true
                    break;
                }
            }
            if ( !(inserted) ) {
                this.stored_data.push(ref)
            }

        } else {
            this.stored_data.unshift(ref)
        }
    }

}




const SPECIAL_KEY_LENGTH = '_zz_srch_X_field:'.length
const SPECIAL_KEY_NAME = '_zz_srch_X_field:'

const SPECIAL_FUNC_KEY_LENGTH = '_zz_srch_X_func..'.length
const SPECIAL_FUNC_KEY_NAME = '_zz_srch_X_func..'

const SPECIAL_ID_KEY_NAME = '_zz_srch_X_id'


class Searching {

    //
    constructor(conf,QueryInterfaceClass) {
        //  these are to be external references -- set_global_file_list_refs or no searching...
        this.global_file_list = []
        this.global_file_list_by = {}
        //
        this.local_active_searches = {}
        //
        this.shrinkage = conf.shrinkage
        this.backup_file = conf.search_backup_file
        //
        this.QInterfaceClass = ((QueryInterfaceClass !== undefined) ? QueryInterfaceClass : QueryResult)
        //
    }

    set_global_file_list_refs(ref_big_list,ref_big_list_by) {
        this.global_file_list = ref_big_list
        this.global_file_list_by = ref_big_list_by
    }

    //  creats new queries
    async run_query(query) {
        let q = new QueryResult(query)
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
                this.local_active_searches[normalized_query] = q_obj
                let data_descr = q_obj.access(offset,box_count)
                return data_descr    
            }
        }
    }



    from_all_files(orderby) {
        if ( orderby in this.global_file_list_by ) {
            return this.global_file_list_by[orderby]
        }
        return this.global_file_list_by["create_date"]
    }


    search_one_all_files(field,match_text) {
        let list = this.global_file_list_by["update_date"]
        let n = list.length
        for ( let i = 0; i < n; i++ ) {
            let item = list[i]
            if ( item[field] ===  match_text ) {
                return [ item ]
            }
        }
        return []
    }


    search_by_field_all_files(field,match_text) {
        let results = this.global_file_list.reduce((prev,current) => {
            if ( current[field] ===  match_text ) {
                prev.push(current)
            }
            return(prev)
        },[])
        return results
    }

    search_by_function_all_files(funcdef) {
        let results = this.global_file_list.reduce((prev,current) => {
            try {
                if ( funcdef(current) ) {
                    prev.push(current)
                }    
            } catch (e) {}
            return(prev)
        },[])
        return results
    }

    attempt_join_searches(f_obj) {
        let searches = this.local_active_searches
        for ( let query in searches ) {
            let q = searches[query]
            let [match_text,orderby] = q.query.split('|')
            if ( match_text !== 'any' ) {
                if ( this.good_match(f_obj,match_text) ) {
                    q.inject(f_obj,orderby)
                }
            } else {
                q.inject(f_obj,orderby)
            }
        }
    }

    
    // ORDERING....

    // Order a set of record by the time they were updated... (they must include a 'dates' structure field)
    sort_by_updated(results) {
        results = results.sort((a,b) => {
            if ( b.dates && a.dates ) {
                if ( b.dates.updated && a.dates.updated ) {
                    return(b.dates.updated - a.dates.updated)
                }
            }
            return 0
        })
        return results
    }
    
    // Order a set of record by the time they were created... (they must include a 'dates' structure field)
    sort_by_created(results) {
        results = results.sort((a,b) => {
            if ( b.dates && a.dates ) {
                if ( b.dates.created && a.dates.created ) {
                    return(b.dates.created - a.dates.created)
                }
            }
            return 0
        })
        return results
    }

    // Order a set of record by a monotonic score... (they must include a 'score' numeric field)
     sort_by_score(results) {
        results = results.sort((a,b) => {
            return(b.score - a.score)
        })
        return results
    }
    
   
    // implement in descendant
    score_match(check_txt,q_list,mult) {
        let score = 1.0
        return(score*mult)
    }
    
    good_match(f_obj,match_text) {
        return(true)
    }
    // END OF ORDERING....

    

    // _run_query
    _run_query(match_text,orderby) {

        let results = []

        if ( match_text === 'any' ) {
            //
            results = this.from_all_files(orderby)
            //
        } else if ( orderby === SPECIAL_ID_KEY_NAME ) {
            //
            results = this.search_one_all_files("_id",match_text)
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
        } else {
            //
            try {
                //
                results = this.global_file_list.reduce((prev,current) => {
                    if ( this.good_match(current,match_text) ) {
                        prev.push(current)
                    }
                    return(prev)
                },[])
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
        //
        if ( results.length ) {
            // don't create copies... keep a index for the viewer.. but ref the object fix it on delivery
            results = results.map((item,index)=> {
                let c_item = {
                    "entry" : index + 1,
                    "item_ref" : item
                }
                return(c_item)
            })
        }
        //
        return results      // the list of matching items
    }


    ///
    update_global_file_list_quotes_by() {

        let c_results = this.sort_by_created(this.global_file_list)
        let u_results = this.sort_by_updated(this.global_file_list)
        //
        this.global_file_list_by["create_date"] = c_results.map((item,index)=> {
            item.entry = index + 1
            item.score = 1.0
            return(item)
        })
        //
        this.global_file_list_by["update_date"] = u_results.map((item,index)=> {
            item.entry = index + 1
            item.score = 1.0
            return(item)
        })
        //
    }


    prune(delta_timeout) {    
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

        return count
    }


    /// FILES
    // ----
    async backup_searches(do_halt) {
        console.log("backing up searches")
        let output = JSON.stringify(this.local_active_searches)
        if ( output.length === 0 ) {
            output = "{}"
        }
        try {
            await fsPromises.writeFile(this.backup_file,output,'ascii')
            console.log("exiting")
            if ( do_halt === true ) {
                console.log("halting ... backing up searches")
                process.exit(0)
            }
        } catch (e) {
            console.error(e)
        }
    }


    async restore_searches() {
        console.log("restoring searches")
        try {
            let searchbkp = await fsPromises.readFile(this.backup_file,'ascii')
            searchbkp = searchbkp.toString()

            this.local_active_searches = {}

            let stored_obj = JSON.parse(searchbkp)    
            for ( let k in stored_obj ) {
                let restored = stored_obj[k]
                let q = new QueryResult('',restored)
                this.local_active_searches[k] = q
            }

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

    add_just_one(f_obj,from_new) {
        let is_new = from_new == undefined ? false : from_new
        if ( f_obj.dates === undefined ) {
            is_new = true
            f_obj.dates = {
                "created" : Date.now(),
                "updated" : Date.now()
            }
        }
        // 
        if ( is_new ) {
            this.global_file_list.unshift(f_obj)
            f_obj.entry = this.global_file_list.length
            f_obj.score = 1.0
            this.global_file_list_by["create_date"].unshift(f_obj)
            this.global_file_list_by["update_date"].unshift(f_obj)    
            this.attempt_join_searches(f_obj)
        } else {
            if ( f_obj._tracking ) {
                let found = false
                let n = this.global_file_list.length
                for ( let i = 0; i < n; i++ ) {
                    if ( this.global_file_list[i]._tracking === f_obj._tracking ) {
                        let stored = this.global_file_list[i]
                        Object.assign(stored,f_obj)
                        found = true
                        break;
                    }
                }
                if ( !found ) {
                    this.global_file_list.push(f_obj)
                    f_obj.entry = this.global_file_list.length
                    f_obj.score = 1.0    
                    this.attempt_join_searches(f_obj)
                }
                this.update_global_file_list_quotes_by()
            } else {
                this.global_file_list.push(f_obj)
                f_obj.entry = this.global_file_list.length
                f_obj.score = 1.0
                this.update_global_file_list_quotes_by()
                this.attempt_join_searches(f_obj)
            }
        }
    }


    remove_just_one(tracking) {
        //
        let n = this.global_file_list.length
        let remove_index = -1
        //
        let stored = false
        for ( let i = 0; i < n; i++ ) {
            if ( this.global_file_list[i]._tracking === tracking ) {
                stored = this.global_file_list[i]
                stored._tracking = false
                stored._xxzz_removed = true
                remove_index = i
                break
            }
        }
        //
        if ( remove_index >= 0 ) {
            this.global_file_list.splice(remove_index,1)
        }
        //
        for ( let ky in this.global_file_list_by ) {
            let list = this.global_file_list_by[ky]
            for ( let i = 0; i < n; i++ ) {
                if ( list[i]._xxzz_removed ) {
                    remove_index = i
                    break
                }
            }
            if ( remove_index >= 0 ) {
                list.splice(remove_index,1)
            }
        }

        if ( stored !== false ) {
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
        }
    }
}



module.exports.Searching = Searching
module.exports.QueryResult = QueryResult