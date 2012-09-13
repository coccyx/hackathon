fm = function() {
    var fm = this;
    Async = splunkjs.Async;
    utils = splunkjs.Utils;
    UI = splunkjs.UI;
    var http = splunkjs.ProxyHttp("/proxy");
    fm.service = new splunkjs.Service(http, {
        "scheme": "https",
        "host": "http://ec2-107-22-141-104.compute-1.amazonaws.com/",
        "port": 8089,
        "username": "admin",
        "password": "hackathon"
    });
}

/*
** Search Splunk.  Takes full splunk search string and calls a callback with (err, results)
*/
fm.prototype.rtsearch = function(searchstr, callback, donecallback) {
    var splunkbot = this;
    var donecallback = donecallback || function () { };
    var MAX_COUNT = 10 * 60; // 10 Minutes
    Async.chain([
            // First, we log in
            function(done) {
                splunkbot.service.login(done);
            },
            // Perform the search
            function(success, done) {
                if (!success) {
                    done("Error logging in");
                }
            
                splunkbot.service.search(
                    searchstr, 
                    {earliest_time: "rt-1m", latest_time: "rt", auto_cancel: MAX_COUNT, max_time: MAX_COUNT}, 
                    done);
            },
            // The search is never going to be done, so we simply poll it every second to get
            // more results
            function(job, done) {
                var count = 0;
                
                // Since search will never be done, register an unload event which will close the search
                // if the window is closed
                $(window).unload(function() {
                    job.cancel(done);
                });
                
                Async.whilst(
                    // Loop for N times
                    function() { return MAX_COUNT > count; },
                    //function() { true; },
                    // Every second, ask for preview results
                    function(iterationDone) {
                        Async.sleep(1000, function() {
                            job.preview({}, function(err, results) {
                                if (err) {
                                    iterationDone(err);
                                }

                                // Up the iteration counter
                                count++;
                            
                                // Only do something if we have results
                                if (results.rows) {                                    
                                
                                    // console.log("========== Iteration " + count + " ==========");
                                    // var sourcetypeIndex = utils.indexOf(results.fields, "sourcetype");
                                    // var countIndex      = utils.indexOf(results.fields, "count");
                                    //                                 
                                    // for(var i = 0; i < results.rows.length; i++) {
                                    //     var row = results.rows[i];
                                    // 
                                    //     // This is a hacky "padding" solution
                                    //     var stat = ("  " + row[sourcetypeIndex] + "                         ").slice(0, 30);
                                    // 
                                    //     // Print out the sourcetype and the count of the sourcetype so far
                                    //     console.log(stat + row[countIndex]);   
                                    // }
                                    //                                 
                                    // console.log("=================================");
                                    
                                    // Splunkbot inserted to call callback here when we have results
                                    if (results.rows.length > 0) {
                                        callback(undefined, results);
                                    }
                                }
                                
                                // And we're done with this iteration
                                iterationDone();
                            });
                        });
                    },
                    // When we're done looping, just cancel the job
                    function(err) {
                        job.cancel(done);
                        donecallback();
                    }
                );
            }
        ],
        function(err) {
            callback(err);        
        }
    );
}