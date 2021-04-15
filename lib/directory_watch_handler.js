
const { watch } = require('fs/promises');
const { access } = require('fs/promises');
const { readFile } = require('fs/promises');
const { constants } = require('fs');
const path = require('path');
const { type } = require('os');

const ac = new AbortController();
const { signal } = ac;
setTimeout(() => ac.abort(), 10000);

class DirWatcherHandler {

    constructor(directory,element_manager) {
        //
        this._dir = directory
        this._el_manager = element_manager
        this._single_file_type = '.json'
        //
        this._tracking_list_map = {}
    }

    track_list_id(name_id) {
        // should be application defined... here is a default
        const track_key = "TRACKLIST::"
        if ( (typeof name_id === "string") && (name_id.substr(track_key.length) === track_key) ) {
            return(true)
        } else {
            return(false)
        }
    }

    //
    //
    async start() {
        try {
            const watcher = watch(this._dir);
            for await (const event of watcher) {
                let {eventType,filename} = event
                let fname = filename.trim()
                if ( !(this.pass_filter(fname)) ) {
                    continue; // don't do anything
                }
                //
                let fpath = this._dir + '/' + fname
                //
                if ( eventType === 'change' ) {
                    await this.read_and_injest(fpath)
                } else if ( eventType === 'rename' ) {
                    try {
                        await access(fpath, constants.R_OK | constants.W_OK);
                        await this.read_and_injest(fpath)
                        continue
                    } catch (e) {
                    }
                    this.remove_just_one_asset(fname)
                }
            }
        } catch (err) {
            if (err.name === 'AbortError')
                return;
            throw err;
        }
    }

    //
    pass_filter(fname) {
        if ( fname.substr(0,2) === '._' ) return(false)
        if ( path.extname(fname) !==  this._single_file_type ) return(false)
        return(true)
    }

    async read_and_injest(path) {
        if ( path ) {
            try {
                await access(path, constants.R_OK | constants.W_OK);
                // READ NEW FILE
                try {
                    let data = await readFile(path)
                    data = data.toString()
                    this.add_just_one_new_asset(data)
                } catch (e) {
                    console.error(err); return;
                }
            } catch(e) {
                // suppress error
            }
        }
    }
    //
    
    //
    add_just_one_new_asset(data) {
        if ( data.length > 1 &&  (this._el_manager != false) ) {
            try {
                let f_obj = JSON.parse(data)
                if ( Array.isArray(f_obj) ) {
                    if ( this._el_manager ) {
                        let tracking = f_obj.shift()
                        let new_tracks = []
                        this._tracking_list_map[tracking] = new_tracks
                        for ( let fobj of f_obj ) {
                            this._el_manager.add_just_one(fobj)
                            new_tracks.push(fobj._tracking)
                        }
                    }
                } else {
                    if ( this._el_manager ) this._el_manager.add_just_one(f_obj)
                }
                return(f_obj)
            } catch (e) {
                console.log(e)
                return(false)
            }    
        } else {
            constole.log(`not adding data ${data}`)
            return(false)
        }
    }

    //
    remove_just_one_asset(name_id) {
        if ( this._el_manager ) {
            if ( this.track_list_id(name_id) ) {  // remove an array completely
                let tracks = this._tracking_list_map[name_id]
                if ( tracks ) {
                    delete this._tracking_list_map[name_id]
                    for ( let track of tracks ) {
                        this._el_manager.remove_just_one(track)
                    }
                }
            } else {
                this._el_manager.remove_just_one(name_id)
            }
        }
    }
}


module.exports = DirWatcherHandler