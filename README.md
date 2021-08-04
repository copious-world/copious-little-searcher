# Copious Little Searchers

This module exposes a set of classes that manage search queries on meta data descriptors, and also that provide system routines that injest metat data newely introduced into derived application's local databases.

Classes that respond to obtaining more data are likely to be moved to another repository soon. And, this module will provde connectors so that the application may specify data handlers that call on the searching.

## How it is used

Currently, one application service calls upon these classes for serving meta data to a blog interface. Those can be found in the following repository [mini\_link\_servers](https://github.com/copious-world/mini_link_servers).

The mini-link-servers are fastify (or express or nano) apps that call relay UI sourced queries to the search module. The search module uses the matching method defined by the searcher app to discover records, and then it returns the records in an array to be sent back to the UI (client).

The little-searcher is not aware of the mechanics of outside ops and just manages the searches and the records. 

## Getting New Records

Records or JSON objects including meta data information about media that might be delivered by a streaming sevice or perhaps it might be blog entries. Important to the meta-data usage is a field in each JSON object, **\_tracking**. The **\_tracking** field is used to locate the object for list management purposes.

Processes outside the server application may deliver a new record containing a **\_tracking** field. How the field value is defined is managed by the application processes. For example, the server found int [copious-blog-entries](https://github.com/copious-world/copious-blog-entries) will write data to directories that the little-searcher application can respond to if its directory-watcher class is in use. Watchers or internet endpoints (subscribers - say) can respond to the the new meta data entry and call a method called **add\_just\_one** with the JSON object as its parameter.

## Matching Queries

The meta data JSON object would certainly have other fields than **\_tracking**. These other fields can be used in the search. They are to be handled by the application methods in descendant classes. The litte-searcher uses scores from the application matching methods and orders searches by the score.

The application calls that descend from the class **Searching** must implement the methods ```good_match```.

The **good_match** function returns a boolean, true if the score is above some application defined threshold. The score is added to the meta data JSON object. The score field added is **score**.

## Methods in the class, Searching

Here is a list of methods that the **Searching** class exposes. 

* constructor(conf,QueryInterfaceClass)

> The constuctor uses the conf object. *conf.shrinkage* is multiplied by score results. *conf.search_backup_file* specifies a file to store current searches, which will be reloaded at the next startup.

* get\_search(query,offset,box_count)
> **get\_search** takes in a query string with an expected format. It may use the offset into the search list corresponding to the query. And, it will return as many records as box\_count.

* add\_just\_one(f_obj,from\_new)
* remove\_just\_one(tracking)
* clear(query)
* async restore\_searches()
* async backup\_searches(do\_halt)
* prune(delta\_timeout)
* get\_search(query,offset,box_count)

