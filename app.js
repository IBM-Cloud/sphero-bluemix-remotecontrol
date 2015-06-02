//------------------------------------------------------------------------------
// Copyright IBM Corp. 2014, 2015
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//------------------------------------------------------------------------------
/*jshint node:true*/

var express = require('express');
var fs = require("fs");
var mqtt = require('mqtt'),
	http = require('http'),
	https = require('https'),
	streamifier = require('streamifier');
var domain = require('domain');

//add startsWith and endsWith to String prototype
if (typeof String.prototype.startsWith != 'function') {
	String.prototype.startsWith = function(str) {
		return this.slice(0, str.length) == str;
	};
}

// setup middleware
var app = express();
app.use(express.static(__dirname + '/public')); //setup static public directory
app.use(function(req, res, next) {
	// create domain and add request and response
	var d = domain.create();
	d.add(req);
	d.add(res);

	d.on('error', function(err) {
		console.log(err.stack);
		try {
			res.writeHead(500, {
				'Content-Type' : 'application/json'
			});
			res.end('{\"error\":\"Service unavailable.\"}');
		} catch (error) {
		}
	});
	d.run(next);
});

// There are many useful environment variables available in process.env.
// VCAP_APPLICATION contains useful information about a deployed application.
var appInfo = JSON.parse(process.env.VCAP_APPLICATION || "{}");
// TODO: Get application information and use it in your app.

// VCAP_SERVICES contains all the credentials of services bound to
// this application. For details of its content, please refer to
// the document or sample of each service.
var services = JSON.parse(process.env.VCAP_SERVICES || "{}");
// TODO: Get service credentials and communicate with bluemix services.

var settings = {
	iot_deviceOrg: "irnwk2",
	iot_deviceType: "and",
	iot_apiKey: "",
	iot_apiToken: "",
}
var iot_server = settings.iot_deviceOrg + ".messaging.internetofthings.ibmcloud.com";
var iot_port = 1883;
var iot_username = settings.iot_apiKey;
var iot_password = settings.iot_apiToken;
var iot_clientid = "a:" + settings.iot_deviceOrg + ":webserver" + Math.floor(Math.random() * 10000);
var iot_deviceType = settings.iot_deviceType;
var iot_deviceOrg = settings.iot_deviceOrg;


// check if application is being run in cloud environment
if (process.env.VCAP_SERVICES) {
  var services = JSON.parse(process.env.VCAP_SERVICES);

  for (var svcName in services) {
    if (svcName.match(/^iotf-service/)) {
      var myCreds = services[svcName][0]['credentials'];
      iot_deviceOrg = myCreds.org;
      iot_username = myCreds.apiKey;
      iot_password = myCreds.apiToken;
    }
  }
}

// obtain IoTF credentials from VCAP
var iot_props = null;
var tripSummaries = {};

// obtain IoTF credentials from VCAP
var iot_props = null;

if (process.env["iotf-service"]) {
	iot_props = process.env['iotf-service'][0]['credentials'];
} else {
	iot_props = {
		mqtt_host: "xxx.messaging.internetofthings.ibmcloud.com",
		apiKey: "xxx",
		apiToken: "xxx",
		org: "xxx"
	};
	console.log('You must bind the Internet of Things service to this application');
}
console.log(iot_props);


console.log(iot_server, iot_clientid, iot_username, iot_password);
var client = mqtt.createClient(1883, iot_server, { clientId: iot_clientid, username: iot_username, password: iot_password });

var http = require('http'),
    https = require('https');


client.subscribe("iot-2/type/"+iot_deviceType+"/id/+/evt/+/fmt/json");
client.subscribe("iot-2/type/"+iot_deviceType+"/id/+/mon/+/fmt/json");

var cache = {};
client.on("message", function(topic, message) {
	//console.log("message recv: " + topic + " = " + message);
	var id = topic.split("/")[4];
	var evt = topic.split("/")[6];
	try {
		message = JSON.parse(message);
	} catch (e) {
		message = message;
	}
	if (!cache[id]) { cache[id] = {}; }
	console.log("cache["+id+"]["+evt+"] = ", message);
	cache[id][evt] = [{"evt_type":evt,"timestamp":{"$date":(new Date()).getTime()},"evt":message}];
});

//setInterval(function() { console.log(JSON.stringify(cache, null, 4)); }, 5000);
app.get('/cache/:deviceId', function(req, res) {
	res.send(cache[req.params.deviceId]);
});




/*
 * First chain of the request. Set up a domain
 * and handle any errors. The application will
 * not be shutdown by an error.  
 */
app.use(function(req, res, next) {

	// create domain and add request and response
	var d = domain.create();
	d.add(req);
	d.add(res);

	d.on('error', function(err) {
		console.log(err.stack);
		try {
			res.writeHead(500, {                                                                         
				'Content-Type' : 'application/json'
			});
			res.end('{\"error\":\"Service unavailable.\"}');
		} catch (error) {

		}
	});

	d.run(next);

});

app.get('/deviceList', function(client_req, client_res) {
	var options = {
		host: 'internetofthings.ibmcloud.com',
		port: 443,
		method: 'GET',
		path: 'api/v0001/organizations/' + iot_deviceOrg + '/devices/' + iot_deviceType,
		auth: iot_username + ":" + iot_password,
	};

	var proxy = https.request(options, function (res) {
		res.pipe(client_res, {
			end: true
		});
	});

	client_req.pipe(proxy, {
		end: true
	});
});

/*
 * Get tripSummary event records 
 */
app.get('/tripSummary', requestWrapper(function(client_req, client_res) {

	// options for the actual http/https request
	var options = { 
			host: 'internetofthings.ibmcloud.com',
			port: 443,
			method: 'GET',
			auth: 'xxx:xxx'
	};

	// an array that will be used to store the result of the request(s)
	var data = [];

	// object to keep all request/proxy data in
	var proxyData = {
			client_req: client_req,
			client_res: client_res,
			tripSummaryRequest: true,
			response: null,
			onfinish: null,
			aggregateReqData: null,
			options: options,
			session: null,
			cursorid: null,
			data: data
	}
	
	proxyData.onfinish = processRemoteRequest;
	var options = proxyData.options;
	var client_req = proxyData.client_req;
	var path = '/api/v0001/historian/xxx/and';
	
	var args = "";
	
	// if a deviceId query parameter was specified
	if (client_req.query && client_req.query.deviceId) {
		path += "/" + encodeURIComponent(client_req.query.deviceId);
	}
	
	// limit the results 
	if (client_req.query && client_req.query.top) {
		args += "&top="+client_req.query.top;
	}   

	// if recent query parameter specified - convert to start
	if (client_req.query && client_req.query.recent) { 
		var start = (new Date()).getTime() - (client_req.query.recent * 1000);
		args += "&start="+start; 
	}
	
	path += '?evt_type=tripSummary' + args;
	options.path = path;
	invokeRemoteRequest(proxyData);

}));

/*
 * Get telemetry event records 
 */
app.get('/tripData', requestWrapper(function(client_req, client_res) {

	// Make sure the request contains an event type parameter
	var eventType = null;
	if (client_req.query && client_req.query.type) {
		eventType = client_req.query.type;
	}   else {
		client_res.writeHead(400, {                                                                         
			'Content-Type' : 'application/json'
		});
		client_res.end('{\"error\":\"Trip data type not specified.\"}');
		return;
	}
	
	// Make sure the request contains a tripId parameter
	var tripId = null;
	if (client_req.query && client_req.query.tripId) {
		tripId = client_req.query.tripId;
	}   else {
		client_res.writeHead(400, {                                                                         
			'Content-Type' : 'application/json'
		});
		client_res.end('{\"error\":\"Trip id not specified.\"}');
		return;
	}
	
	
	// options for the actual http/https request
	var options = { 
			host: 'internetofthings.ibmcloud.com',
			port: 443,
			method: 'GET',
			auth: 'xxx:xxx'
	};

	// an array that will be used to store the result of the request(s)
	var data = [];

	// object to keep all request/proxy data in
	var proxyData = {
			client_req: client_req,
			client_res: client_res,
			tripSummaryRequest: false,
			response: null,
			onfinish: null,
			aggregateReqData: null,
			options: options,
			session: null,
			cursorid: null,
			data: data
	}
	
	proxyData.onfinish = processRemoteRequest;
	var client_req = proxyData.client_req;
	var path = '/api/v0001/historian/xxx/and';
	
	var args = "";
	
	// if we do not have a cache entry for the trip id specified
	if (!tripSummaries[tripId]) {
		client_res.writeHead(500, {                                                                         
			'Content-Type' : 'application/json'
		});
		client_res.end('{\"error\":\"Trip id not found.\"}');
		return;
	}
	
	// use information from trip summary to query applicable records
	var tripRecord = tripSummaries[tripId];
	path += "/" + encodeURIComponent(tripRecord.deviceId);
	args += "&start="+ tripRecord.startTime; 
	args += "&end="+ tripRecord.stopTime;
	path += '?evt_type=' + eventType + args;
	options.path = path;

	invokeRemoteRequest(proxyData);

}));

/**
 * Convenience wrapper - catch any error from the actual
 * request and emit an error so our domain can process it.
 * 
 * @param  func  The function that should be wrapped 
 */
function requestWrapper(func) {
	return function(req, res) {
		try {
			return func(req, res);
		} catch (err) {
			domain.active.emit('error', err);
		}
	}
}

/**
 * Starting point for aggregate requests to IoTF
 * 
 * @param proxyData  An object containing relevant data to 
 *                   the proxied requests. 
 */
function doAggregateRequest(proxyData) {
	
	var client_req = proxyData.client_req;
	proxyData.onfinish = processAggregateRequest;
	aggregateReqData = {};
	
	var type = 'avg';
	if (client_req.query.type) {
		type = client_req.query.type;
	}
	
	var points = client_req.query.points;
	var now = new Date().getTime();
	var start = (now - (client_req.query.recent * 1000));
	var interval = Math.floor(((client_req.query.recent * 1000) / points));
    console.log("interval: " + aggregateReqData.interval);
	var pathPrefix = '/api/v0001/historian/joykkh/sphero/' + encodeURIComponent(client_req.params.deviceId) + 
					 			'?evt_type='+client_req.params.evtType + '&summarize={value}&summarize_type=' + type;
    
    
    aggregateReqData = {
    		finished : false,
    		type: type,
    		currentPoint: 0,
    	    end: now,
    	    start: start,
    	    interval: interval,
    		pathPrefix: pathPrefix,
    		path: null
    };
    
    proxyData.aggregateReqData = aggregateReqData;
	invokeAggregateRequest(proxyData);
}

/**
 * Process responses from IoTF. These are the proxied responses.
 *  
 * @param proxyData  An object containing relevant data to 
 *                   the proxied requests. 
 */
function processRemoteRequest(proxyData) {

	// check for cursorid
	var client_res = proxyData.client_res;
	var response = proxyData.response;
	var data = proxyData.data;
	
	var cursorid = response.headers.cursorid;
	if (!cursorid || data.length == 10) {

		// no cursorid so we are done
		client_res.writeHead(response.statusCode, response.headers);

		/*
		 * If there are multiple Buffers in the data array 
		 * we must remove the appropriate beginning/end brackets
		 * from the JSON. Also add a comma where needed.
		 * 
		 * The idea is we want one array - one JSON array.
		 */
		if (data.length > 1) {
			
			// we have more than one buffer 
			for (var i = 0; i < data.length; i++) {
				var dataBuf = data[i];
				// replace begging bracket with space 
				if (i > 0) {
					dataBuf[0] = '0x20';
				}
				
				if (i !== data.length -1) {
					// if this is not the last buffer add comma
					dataBuf[dataBuf.length - 1] = '0x2c';
				}
			}

		}

		// concatenate all the buffers into one.
		var buf = Buffer.concat(data);
		if (proxyData.tripSummaryRequest) { 
			var resultData = JSON.parse(buf.toString());
			var i = 0;
			for (i = 0; i < resultData.length; ++i) {
				console.log("adding trip summary for tripId " + resultData[i].evt.tripId);
			    tripSummaries[resultData[i].evt.tripId] = resultData[i].evt;
			}
		}
		console.log(buf.toString());
		var resultStream = streamifier.createReadStream(buf, {encoding:"utf8"});
		resultStream.pipe(client_res, {end: true});
	} else {
		// we have a cursorid make another call to IoTF
		var buf = Buffer.concat(data);
		invokeRemoteRequest(proxyData);
	}

}

/**
 * Proxy a request to IoTF. Depending on what the request is
 * it could take several requests to fulfill one request. This 
 * is because IoTF will give back results in sets of 100
 * entries. 
 * 
 * We will know that we need to make subsequent requests if
 * a header entry for cursorid is present. Once there is no
 * entry for cursorid we know we have obtained all entries
 * from the result set
 * 
 * @param proxyData  An object containing relevant data to 
 *                   the proxied requests. 
 * 
 */
function invokeRemoteRequest(proxyData) {

	var options = proxyData.options;
	var client_req = proxyData.client_req;
	
	// Array of Buffers for this request
	var requestData = [];
	var headerValues = {};
	if (proxyData.session) {
		headerValues.cookie = proxyData.session;
	}
	
	// set the cursorid for the next request
	if (proxyData.cursorid) {
		headerValues.cursorid = proxyData.cursorid;
	}
	
	options.headers = headerValues;
	console.log(options.path);
	
	var proxy = https.request(options, function (response) {
		
		console.log("Code: " + response.statusCode);
		response.on('data', function (chunk) {
			// keep adding chunks....
			requestData.push(chunk);
		});
		
		response.on('end',function(){
			proxyData.response = response;
			var cookies = response.headers["set-cookie"];
			if (cookies && cookies.length > 0) {
				if (cookies[0].indexOf("iotHistorianSessionId") > -1) {
					proxyData.session =  cookies[0];
				}
			}
			var buf = Buffer.concat(requestData);
			proxyData.data.push(buf);
			proxyData.onfinish(proxyData);
		});
		
		response.on('error', function(err){
			console.log("Error Occurred: " + err.message);
			client_res.writeHead(500, {
				'Content-Type' : 'application/json'
			});
			client_res.end('{\"error\":\"Internal server error. Try again later.\"}');
		});

	}); 

	// invoke proxy request
	client_req.pipe(proxy, {end: true});

}


/**
 * 
 * Process aggregate responses from IoTF. These are the proxied responses.
 * This callback is specifically for aggregate requests.
 * 
 * @param proxyData  An object containing relevant data to 
 *                   the proxied requests. 
 */
function processAggregateRequest(proxyData) {
	
	var aggregateReqData = proxyData.aggregateReqData;
	var client_res = proxyData.client_res;
	var response = proxyData.response;
	var data = proxyData.data;


	if (aggregateReqData.finished) {

		// all aggregate requests are finished
		client_res.writeHead(response.statusCode, response.headers);

		// write one JSON array containing all aggregate points
		var resultsString = '[';
			
			// iterate over each aggregate point in the results array
			for (var i = 0; i < data.length; i++) {
				resultsString =  resultsString + data[i];
				
				// add comma if not the last point
				if (i !== data.length -1) {
					resultsString =  resultsString + ',';
				}
				
			}
		resultsString = resultsString + ']';

		// wrap result in stream and pipe to client response
		var buf = new Buffer(resultsString);
		var resultStream = streamifier.createReadStream(buf, {encoding:"utf8"});
		resultStream.pipe(client_res, {end: true});
	} else {
		// not finished - get next aggregate point
	    invokeAggregateRequest(proxyData);
	}

}

/**
 * Proxy an IoTF aggregate API request.
 * 
 * Depending on what the request is it could take several 
 * requests to fulfill one request. This depends on the 
 * number of data points requested and the time interval 
 * specified.
 * 
 * 
 * @param proxyData  An object containing relevant data to 
 *                   the proxied requests.
 */
function invokeAggregateRequest(proxyData) {
	
	// set up some variables from the proxyData object
	var aggregateReqData = proxyData.aggregateReqData;
	var options = proxyData.options;
	var client_res = proxyData.client_res;
	var client_req = proxyData.client_req;
	
	// update the data in the aggregateReqData object
    updateAggregateData(aggregateReqData);
	var headerValues = {};
	if (proxyData.session) {
		headerValues.cookie = proxyData.session;
	}
	
	options.path = aggregateReqData.path;
	options.headers = headerValues;

	// Array of Buffers for this request
	var requestData = [];

	console.log(options.path);
	console.dir(options);
	
	var proxy = https.request(options, function (response) {
		
		response.on('data', function (chunk) {
			// keep adding chunks....
			requestData.push(chunk);
		});
		
		response.on('end',function(){
			
			proxyData.response = response;
			
			// if there is a session cookie use it for next request
			var cookies = response.headers["set-cookie"];
			if (cookies && cookies.length > 0) {
				if (cookies[0].indexOf("iotHistorianSessionId") > -1) {
					proxyData.session =  cookies[0];
				}
			}
			
			// place entire result in one string
			var resultStr = Buffer.concat(requestData).toString();
			if (resultStr.startsWith("{\"error\"")) {
				// we have an error - end now
				client_res.writeHead(500, {
					'Content-Type' : 'application/json'
				});
				client_res.end(resultStr);
			} else {
				// get result as a JSON string - add it to the result array
				proxyData.data.push(getAggregateResult(resultStr, aggregateReqData));
				proxyData.onfinish(proxyData);
			}
		});
		
		response.on('error', function(err){
			console.log("Error Occurred: " + err.message);
			client_res.writeHead(500, {
				'Content-Type' : 'application/json'
			});
			client_res.end('{\"error\":\"Internal server error. Try again later.\"}');
		});

	}); 

	// invoke the proxy request
	client_req.pipe(proxy, {end: true});

}


/**
 * 
 * @param resultString  -    An IoTF aggregate result in the form of a
 *                           JSON string.                        
 * @param aggregateReqData   Object containing aggregate request data
 *                           for the proxied requests
 *                           
 * @returns                  A JSON string that contains the IoTF result
 *                           and other data applicable to the proxied
 *                           request
 */
function getAggregateResult(resultString, aggregateReqData) {
	
	// first parse IoTF result
	var jsonResult = JSON.parse(resultString);
	
	// add applicable attributes to the object
	jsonResult[0].start = aggregateReqData.currentRequest.start;
	jsonResult[0].end = aggregateReqData.currentRequest.end;
	jsonResult[0].point = aggregateReqData.currentRequest.point;
	
	// return JSON string
	return JSON.stringify(jsonResult[0]);
	
}

/**
 * A simple convience function to assist with aggregate proxy
 * requests. This function will help obtain time ranges for 
 * queries and keep track of data points. It will also update
 * a boolean flag indicating that all aggregate data has been
 * obtained.
 * 
 * @param aggData  An object containing all data that is relevant
 *                 to aggregate requests. 
 */
function updateAggregateData(aggData) {
	
	// if finished return
	if (aggData.finished) {
		return;
	}

	// update end time 
	var endValue = aggData.start + aggData.interval; 
	
	if (endValue >= aggData.end) {
		endValue = aggData.end + 1;
		aggData.finished = true;
	}
	
	// create new query for next aggregate request to IoTF
	var summaryQuery = aggData.pathPrefix + '&start=' + aggData.start + '&end=' + (endValue -1);
	aggData.currentRequest = {start:aggData.start, end:(endValue -1), point:aggData.currentPoint};
	aggData.currentPoint++;
	aggData.start = endValue;
	aggData.path = summaryQuery;
	
}

// The IP address of the Cloud Foundry DEA (Droplet Execution Agent) that hosts this application:
var host = (process.env.VCAP_APP_HOST || 'localhost');
// The port on the DEA for communication with the application:
var port = (process.env.VCAP_APP_PORT || 3001);
// Start server
app.listen(port, host);
console.log('App started on port ' + port);