


const fs = require('fs')
const path = require('path')

// Purpose: This is for initalization of the total list of all objects used by the Searching class (and may be used to reload the list).
//
// ObjFileDirLoader loads existing directories of meta data objects.
// It is left up to the application to call upon it and to make it available.
//
// When the ObjFileDirLoader impementation is constructed, a reference to a shared lists (shared among lib objecst)
// is past. This list if filled with object that are found in the configured directory.
// 
// The application makes the external data structures available and expects the loader, load_directory.  to 
// put objects from the directory into the list.
//
// The only extra functionality other than reading a directory is that each file, always in JSON format, may contain a single object
// or it may be an array of objects. The injector will add objects of the array to the list _list (externally constructed) or it will
// be adding a single object to the list. 

class ObjFileDirLoader {
    constructor(dirpath,list_ref,after_loaded_action) {
        this._dir = dirpath
        this._after_action = after_loaded_action
        this._list = list_ref               // must be created externally
        this._noisy = false
        this._crash_cant_load = false
    }

    set noisy(what) {
        this._noisy = what
    }

    get noisy() {
        return this._noisy
    }

    set crash_cant_load(what) {
        this._crash_cant_load = what
    }

    get crash_cant_load() {
        return this._crash_cant_load
    }


    item_injector(obj) {
        if ( Array.isArray(obj) ) {
            for ( let fobj of obj ) {
                this.item_injector(fobj)
            }
        } else {
            this._list.push(obj)
        }
    }

    load_directory() {
        //
        fs.readdir(this._dir, (err, files) => {
            if (err)  {
                console.log(err);
                if ( this._crash_cant_load ) {
                    process.exit(0)
                }
            } else { 
                // console.log("\Filenames with the .txt extension:"); 
                files.forEach(file => { 
                    if ( path.extname(file) == ".json" ) {
                        if ( this._noisy ) {
                            console.log(file)
                        }
                        //
                        let fpath = this._dir + '/' + file
                        let fdata = fs.readFileSync(fpath).toString()   // initialization time
                        try {
                            let f_obj = JSON.parse(fdata)
                            this.item_injector(f_obj)
                        } catch(e) {
                            console.log(file)
                        }
                        //
                    } 
                })
                //
                if ( this._after_action ) {
                    this._after_action()
                }
            }
        }) 
      
    }
}




module.exports = ObjFileDirLoader
