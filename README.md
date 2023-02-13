# Copious Little Searchers

This module exposes a set of classes that manage search queries on meta data descriptors, and also that provide system routines that injest meta data newely introduced into derived applications' local databases.

It is an application of the [copious-registry](https://www.npmjs.com/package/copious-registry) module.

## purpose

This module is called a `little` searcher because it is intentionally a small amount of code that does not attempt to do too much by itself.

This module provides configurable search behavior with a simplistic default solution. In the default case, this module provides searching and object management on small lists of objects stored in JavaScript data structures. 

In the configured varieties, this provide a proxy interface to anything that will implement the interface. (The `anything` here might be a data center.) It provides some data management on results in order to marshal them to the clients such as browsers looking for types of entries. So, the final array of results will be finally produced by this module and be returned from the method `get_seach`.

This module can also be used as a data manager class within another application. It can retrieve specific entries or a set of fuzzy matches as needed. It is in some sense a container with fuzzy searching features.

## install

```
npm install -s copious-little-searcher
```


## Special Fields

There are three special fields that the little-searchers will use when dealing with JSON objects that it receives. Theses are the following:

* **\_tracking**
* **dates**
* **score**

Applications using little-searchers should produce objects with these fields. The application can make values for these fields, and must for **\_tracking**. **\_tracking** must be unique - unless the application has use for collisions. The **score** field will be overwritten in any case, and it will be added if it is not in the application JSON objects sent to the little-searchers. The **dates** field has a specific format. The following will clarify these requirements.

## How it is used

Currently, one application service calls upon these classes for serving meta data to a blog interface. Those can be found in the following repository [mini\_link\_servers](https://github.com/copious-world/mini_link_servers).

The mini-link-servers are polka (or express or fastify) apps that can relay UI sourced queries to the search module. The search module uses the matching method defined by the searcher app to discover records, and then it returns the records in an array to be sent back to the UI (client).

## Getting New Records

Records are JSON objects that include meta data information about media that might be one of several types, perhaps that might be audio or movies from a streaming sevice or perhaps it might be blog entries. Important to the meta-data usage is a field in each JSON object, **\_tracking**. The **\_tracking** field is used to locate the object for list management purposes.

Processes outside the server application may deliver a new record containing a **\_tracking** field. How the field value is defined is managed by the application processes. For example, the server found in [copious-blog-entries](https://github.com/copious-world/copious-blog-entries) will write data to directories that the little-searchers application can respond to if its directory-watcher class is in use. (the watchers are provided by [copious-registry](https://www.npmjs.com/package/copious-registry)). Watchers or internet endpoints (subscribers - say) configured into a littel-searcher descendant class may respond to the the new meta data entry by calling a method called **add\_just\_one** with the JSON object as its parameter.

The field,  **\_tracking** is expected. The little-searcher application cannot respond to an object that does not have it. There is one more field that should be supplied by the application, **dates**.

The **dates** field is a structure indicating the time of creation and update. If the **dates** field is not present, the little-searcher will assume that the object it is adding is new and add a **dates** field to the object.

Here is the **dates** field structure:

```
.dates = {
           "created" : <some number>,
           "updated" : Date.now()
        }
```

## Matching Queries

The meta data JSON object would certainly have other fields than **\_tracking**. These other fields can be used in the search. They are to be handled by the application methods in descendant classes. The litte-searchers use scores from the application matching methods and orders search results by the score.

The applications' class that descends from the class **Searching** must implement the methods ```good_match```.

The **good\_match** function returns a boolean, which should be **true** if the **score** is above some application defined threshold. The **good\_match** method must add the score to the meta data JSON object. 

> The score field to be added is **score**.


## Query Format

The query string accepted by the method, **get_search**, is a Sheffer stroke delimited string containing three parts.

* match text - a URI encoded string
* orderby - the ordering of the search results (a key term)

#### orderby
The second part of the query string may have one of the following values:

* **create\_date**
* **update\_date**
* **score**
* **\_zz\_srch\_X\_field:**
* **\_zz\_srch\_X\_func..**
* **\_zz\_srch\_X\_id**

For the first three vales, **create\_date**, **update\_date**, **score**, the following holds: 
>As many query results as requested or can be found, up to the specified limit (box\_count) will be put in the results list, and the list will be sorted according to the fields belonging to the objects in the search results. If it is the case that the match string (first part of the query) is a wildcard or empty and that the **orderby** parameter cannot be discerned from the query string, the defaul will be to use **create\_date**.

The remaing values are special directives.

**\_zz\_srch\_X\_field:** will use the value of the match text to compare with the value of a field in an object by exact string comparison.

**\_zz\_srch\_X\_func..** will use the value in the match text as JavaScript code and evaluate it. The function should be a boolean function that accepts a meta data JSON object as determined by the applciation. The little-searchers will return a list of all objects for which the function is true.

The javascript expected should be delivered URI encoded.  And it should be an assignement of a lambda definition to a particular variable, **funcdef**. The following is the format:

```
funcdef = (meta_object) => {
	... code that checks the meta object.
	bval = true; // if the object checks out
	return bval
}
```


**\_zz\_srch\_X\_id** expects the match text to be a particular **\_tracking** number. This result returns exatly one search result.


## Searching -- class methods

Here is a list of methods that the **Searching** class exposes. 

* constructor(conf,QueryInterfaceClass)
* get\_search(query,offset,box\_count)
* add\_just\_one(meta_obj,from\_new)
* remove\_just\_one(tracking)
* prune(delta\_timeout)
* backup\_searches(do\_halt)
* restore\_searches
* clear(query)

Methods that must be implemented by descendants:

* score\_match
* good\_match

Method that are not exposed by this implementation:

* run\_query
* \_run\_query(match\_text,orderby)
* attempt\_join\_searches
* app\_specific\_file\_removal
* search\_one\_all\_files
* search\_by\_function\_all\_files
* search\_by\_field\_all\_files

## Searching -- methods details

#### `constructor`

> The constuctor uses the conf object. ***conf.shrinkage*** is multiplied by score results. ***conf.search\_backup\_file*** specifies a file to store current searches, which will be reloaded at the next startup.
> 

```
	conf = {
		"shrinkage" : <number>,
		"search_backup_file"  : <file on disk drive>
	}
```


**parameters**: (conf,QueryInterfaceClass)

* conf -- the configuration object
* QueryInterfaceClass -- an override of the default query handler

----

#### `get_search`

> **get\_search** takes in a query string with an expected format. It may use the offset into the search list corresponding to the query. And, it will return as many records as box\_count. (see above for the query format)
> 
> This method calls `run_query` if the query has not yet been created. Otherwise, it looks in its table for a query object which should already contain the results that this method promises to return.

**parameters**: (query,offset,box\_count)

* query -- a string in the supported query format
* offset -- an offset into the query results list (paging)
* box\_count - the number of objects to fetch in the current call

----


#### add\_just\_one(meta\_obj,from\_new)

> This method will place the meta data object into the general pool of searches. If there are extant queries, this method will attempt to place the object in the queries by running **good\_match** on the object for each query.

**parameters**: 

* meta\_obj -- the object that is being added to global iterable storage
* from\_new -- if true, an attempt will be made to add the object without looking for it first.

----

#### remove\_just\_one

> This method use the tracking string parameter to search out all references to the meta data JSON object whose **\_tracking** == *tracking*. This method searches general lists and the lists of all extant queries.


**parameters**: 

* tracking - the ID of the object being removed

----

#### prune


> As queries are placed into the little-searchers by the application, they are saved for reuse. Queries maintain lists of search results. At some point, the queries may be too numerous for the stability of the search. So, the application may configure request pruning of old queries, older than *delta\_timeout*. 
> 
> It is up to the application to call **prune**. The application may want to set up an interval timer.


**parameters**:

* delta\_timeout - the time cutoff for queries to be in memory

----



#### clear(query)

> Removes the query from the table of queries. It calls the query `clear` method.

**parameters**:

* query - a query as a string (or a key to it)

----




#### async backup\_searches

> This method writes the entire table of queries to a backup file. If *do\_halt* is true, this methods will stop the process from running.
> 
> It is up to the application to call **backup\_searches**.

**parameters**:

* do\_halt -- if true will shutdown the application after backing up

----

#### async restore\_searches()

**no parameters**

> This method reads the configured backup file and rebuilds the query table stored by **backup\_searche**

----



## QueryResult -- class methods

This is a default class that the searching class will use if the application does not override it by mentioning a new class in the configuration object of the **Searching** class.

Implementations looking for very efficient searching and sophisticated matching should override this class. However, those classes should implement the interface of this class so that **Searching** may use it.

Here is a list of methods that the **QueryResult** class exposes. 

* constructor(query,restore)
* set\_data(data)
* inject(f\_obj,ordering)
* serialize
* deserialize

Internal methods this uses that are not part of the interface requirement:

* normalize_query(query\_descr\_str)


## QueryResult -- methods details

#### `constructor`

> The constuctor uses the conf object. ***conf.shrinkage*** is multiplied by score results. ***conf.search\_backup\_file*** specifies a file to store current searches, which will be reloaded at the next startup.
> 

```
	conf = {
		"shrinkage" : <number>,
		"search_backup_file"  : <file on disk drive>
	}
```


**parameters**: (conf,QueryInterfaceClass)

* conf -- the configuration object
* QueryInterfaceClass -- an override of the default query handler

----

#### `get_search`

> **get\_search** takes in a query string with an expected format. It may use the offset into the search list corresponding to the query. And, it will return as many records as box\_count. (see below for the query format)

**parameters**: (query,offset,box\_count)

* query -- a string in the supported query format
* offset -- an offset into the query results list (paging)
* box\_count - the number of objects to fetch in the current call

----

