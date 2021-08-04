# Copious Little Searchers

This module exposes a set of classes that manage search queries on meta data descriptors, and also that provide system routines that injest meta data newely introduced into derived applications' local databases.

**NOTE:** Classes that respond to obtaining more data are likely to be moved to another repository soon. And, this module will provde connectors so that the application may specify data handlers that call on the searching.

## Special Fields

There are three special fields that the little-searchers will use when dealing with JSON objects that it receives. Theses are the following:

* **\_tracking**
* **dates**
* **score**

Applications using little-searchers should produce objects with these fields. The application can make values for these fields, and must for **\_tracking**. **\_tracking** must be unique - unless the application has use for collisions. The **score** field will be overwritten in any case, and it will be added if it is not in the application JSON objects sent to the little-searchers. The **dates** field has a specific format. The following will clarify these requirements.

## How it is used

Currently, one application service calls upon these classes for serving meta data to a blog interface. Those can be found in the following repository [mini\_link\_servers](https://github.com/copious-world/mini_link_servers).

The mini-link-servers are fastify (or express or polka) apps that can relay UI sourced queries to the search module. The search module uses the matching method defined by the searcher app to discover records, and then it returns the records in an array to be sent back to the UI (client).

The little-searcher is not aware of the mechanics of outside ops and just manages the searches and the records. 

## Getting New Records

Records are JSON objects that include meta data information about media that might be one of several types, perhaps that might be audio or movies from a streaming sevice or perhaps it might be blog entries. Important to the meta-data usage is a field in each JSON object, **\_tracking**. The **\_tracking** field is used to locate the object for list management purposes.

Processes outside the server application may deliver a new record containing a **\_tracking** field. How the field value is defined is managed by the application processes. For example, the server found in [copious-blog-entries](https://github.com/copious-world/copious-blog-entries) will write data to directories that the little-searchers application can respond to if its directory-watcher class is in use. Watchers or internet endpoints (subscribers - say) configured into a littel-searcher descendant class may respond to the the new meta data entry by calling a method called **add\_just\_one** with the JSON object as its parameter.

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

## Methods in the class, Searching

Here is a list of methods that the **Searching** class exposes. 

* constructor(conf,QueryInterfaceClass)
> The constuctor uses the conf object. ***conf.shrinkage*** is multiplied by score results. ***conf.search\_backup\_file*** specifies a file to store current searches, which will be reloaded at the next startup.
> 
```
	conf = {
		"shrinkage" : <number>,
		"search_backup_file"  : <file on disk drive>
	}
```

* get\_search(query,offset,box\_count)
> **get\_search** takes in a query string with an expected format. It may use the offset into the search list corresponding to the query. And, it will return as many records as box\_count. (see below for the query format)


* add\_just\_one(meta_obj,from\_new)
> This method will place the meta data object into the general pool of searches. If there are extant queries, this method will attempt to place the object in the queries by running **good\_match** on the object for each query.

* remove\_just\_one(tracking)
> This method use the tracking string parameter to search out all references to the meta data JSON object whose **\_tracking** == *tracking*. This method searches general lists and the lists of all extant queries.

* prune(delta\_timeout)
> As queries are placed into the little-searchers by the application, they are saved for reuse. Queries maintain lists of search results. At some point, the queries may be too numerous for the stability of the search. So, the application may configure request pruning of old queries, older than *delta\_timeout*. 
> 
> It is up to the application to call **prune**. The application may want to set up an interval timer.

* async backup\_searches(do\_halt)
> This method writes the entire table of queries to a backup file. If *do\_halt* is true, this methods will stop the process from running.
> 
> It is up to the application to call **backup\_searches**.

* async restore\_searches()
> This method reads the configured backup file and rebuilds the query table stored by **backup\_searche**

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


