//
const {Registry} = require('copious-registry')
const {FileOperationsCache} = require('extra-file-class')
//
//
function remove_char(match_text,c,r_c) {
    match_text = match_text.split(c)
    return match_text.join(r_c)
}


// check Geeks for Geeks
function bin_search(el, arr, _cmp) {  // for searching by score
   
    let start = 0
    let end = (arr.length-1);
    //
    while ( start <= end ){
        let mid = Math.floor((start + end)/2);
        let cval = _cmp(arr[mid],el)
        if ( cval > 0 ) {
            start = mid + 1;
        } else {
            end = mid - 1;
        }
    }
    if ( start >= arr.length ) return -1;
    return(start)
}



//
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
        this._max_stored_data_length = this.stored_data.length
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
            let qparts = []
            let split_i = query_descr_str.lastIndexOf('|')
            let bad_c = query_descr_str.indexOf('|')
            if ( bad_c !== split_i ) {
                qparts.push(query_descr_str.substr(0,split_i))
                qparts.push(query_descr_str.substr(split_i+1))
                match_text = qparts[0]
            } else {
                qparts = query_descr_str.split("|")
                qparts = qparts.map(apart => { return apart.trim() })
                match_text = decodeURIComponent(qparts[0])
            }
            if ( match_text.indexOf('|') >= 0 ) {
                match_text = remove_char(match_text,'|',' ')
            }    
            match_text = match_text.replace(/\s+/g,' ').trim()
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
        //
        let returned_data = this.stored_data.slice(offset,offset + box_count)
        let count = this.stored_data.length
        //
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
        //
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
        //
        return {
            "data" : returned_data,  // the current small bucket set of data to fit the user view
            "length" : returned_data.length,
            "offset" : offset,
            "count" : count         // number of possible results to view
        }
    }

    // inject
    //  put a new object into a list. Put it at the front if this is not scored (date will be newest). 
    //  If score, then search for the position of the new element and splice it in
    inject(f_obj,ordering) {
        //
        this._max_stored_data_length = Math.max(this.stored_data.length,this._max_stored_data_length+1)
        let ref = {
            "entry" : this._max_stored_data_length,
            "score" : f_obj.score,
            "item_ref" : f_obj
        }
        if ( ordering === 'score' ) {       //bin search
            let i = bin_search(ref, this.stored_data, (a,b) => {
                return(a.score - b.score)
            })
            if ( i < 0 ) {
                this.stored_data.push(ref)
            } else {
                this.stored_data.splice(i,0,ref)
            }
        } else {
            this.stored_data.unshift(ref)
        }
    }

    serialize() {
        let obj = {}
        obj.query = this.query
        obj.when = this.when
        obj.stored_data = []

        obj.stored_data = this.stored_data.map(ref => {
            let tracking = ref.item_ref._tracking
            let score = ref.score
            if ( tracking ) {
                return({ "entry" : ref.entry, "score" : score, "item_ref" : { "_tracking" : tracking }})
            } else {
                return(false)
            }
        })
        //
        obj.stored_data = obj.stored_data.filter(obj => {
            return(obj !== false)
        })
        //
        return(obj)
    }

    deserialize(tracking_map) {
        if ( tracking_map === undefined ) return
        if ( typeof tracking_map !== 'object' ) return
        this.stored_data = this.stored_data.map(ref => {
            let tracking = ref.item_ref._tracking
            if ( tracking ) {
                let item = tracking_map[tracking]
                if ( item ) {
                    ref.item_ref = item
                    return ref
                }
            }
            return false
        })
        this.stored_data = this.stored_data.filter(ref => { return ref !== false })
    }

}


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

const SPECIAL_KEY_LENGTH = '_zz_srch_X_field:'.length
const SPECIAL_KEY_NAME = '_zz_srch_X_field:'

const SPECIAL_FUNC_KEY_LENGTH = '_zz_srch_X_func..'.length
const SPECIAL_FUNC_KEY_NAME = '_zz_srch_X_func..'

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
                this.local_active_searches[normalized_query] = q_obj
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
        let results = []
        for ( let obj of this.global_file_list ) {
            if ( obj[field] === match_text ) {
                results.push(current)
            }
        }
        return results
    }

    search_by_function_all_files(funcdef) {
        let results = []
        for ( let obj of this.global_file_list ) {
            if ( funcdef(obj) ) {
                results.push(current)
            }
        }
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
    // END OF MATCHIN....

    // _run_query
    _run_query(match_text,orderby) {

        let results = []

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
        } else {
            //
            try {
                //
                for ( let object of this.global_file_list ) {
                    if ( this.good_match(object,match_text) ) {
                        results.push(object)
                    }
                }
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
module.exports.QueryResult = QueryResult
