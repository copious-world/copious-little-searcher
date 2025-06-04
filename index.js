const {DirWatcherHandler,ObjFileDirLoader,FileLists} = require('copious-registry')
//
const SearchesByUser = require('./lib/single_owner_searches');
const {Searching} = require('./lib/searching')
const {QueryResult} = require('./lib/default_queries')
//
module.exports.DirWatcherHandler = DirWatcherHandler
module.exports.ObjFileDirLoader = ObjFileDirLoader
module.exports.SearchesByUser = SearchesByUser
module.exports.Searching = Searching
module.exports.QueryResult = QueryResult
module.exports.FileLists = FileLists

