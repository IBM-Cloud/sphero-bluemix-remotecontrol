/**
 * Copyright 2014, 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
window.config = {
	deviceType: "and",
	deviceOrg: "irnwk2",
	appKey: "",
	appToken: "",
}

iot_server = window.config.deviceOrg + ".messaging.internetofthings.ibmcloud.com";
iot_port = (document.location.protocol == "https:" ? 8883 : 1883);
iot_username = window.config.appKey;
iot_password = window.config.appToken;
iot_clientid = "a:"+window.config.deviceOrg+":tester" + Math.floor(Math.random() * 1000); 
iot_deviceType = window.config.deviceType;

client = new Messaging.Client(iot_server, iot_port, iot_clientid);
//client = new Messaging.Client("messagesight.demos.ibm.com", 1883, "pictureviewer"+Math.floor(Math.random() * 10000));

var heading = 0;
var velocity = 0;
var max_velocity = 0.3;
var headingDelta = 0;
$.fn.extend({ 
	disableSelection : function() { 
		this.each(function() { 
			this.onselectstart = function() { return false; }; 
			this.unselectable = "on"; 
			$(this).css('-moz-user-select', 'none'); 
			$(this).css('-webkit-user-select', 'none'); 
		}); 
	} 
});

var getUrlVars = function() {
	var vars = {};
	var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m, key, value) {
		vars[key] = value;
	});
	return vars;
}

var deviceId = (getUrlVars()["id"] != null) ? getUrlVars()["id"].split("/")[0] : null;

function loadDeviceList() {
	$.getJSON("/deviceList", function(data) {
		console.log(data);
		for (var i in data) {
			$("#chariotSelect").append("<option value='"+data[i].id+"'>" + data[i].id + "</option>");
		}
	});
}

var keys = [];

function onDown(ev) {
	if (ev.which) {
		if (keys[ev.which] == "down") { return false; }
		ev.preventDefault = function() {};
		if (ev.which == 37) { ev.target = $("#leftButton")[0]; }
		if (ev.which == 38) { ev.target = $("#driveButton")[0]; }
		if (ev.which == 39) { ev.target = $("#rightButton")[0]; }
		if (ev.which == 40) { ev.target = $("#reverseButton")[0]; }
		keys[ev.which] = "down";
	} 
	if (ev.target.id == "rightButton") {
		$(ev.target).addClass("selectedTouchButton");
		headingDelta = 10;
		if (ev.preventDefault) ev.preventDefault();
		return false;
	} else if (ev.target.id == "leftButton") {
		$(ev.target).addClass("selectedTouchButton");
		headingDelta = -10;
		if (ev.preventDefault) ev.preventDefault();
		return false;
	} else if (ev.target.id == "driveButton") {
		$(ev.target).addClass("selectedTouchButton");
		velocity = max_velocity;
		updateRoll();
		if (ev.preventDefault) ev.preventDefault();
		return false;
	} else if (ev.target.id == "reverseButton") {
		$(ev.target).addClass("selectedTouchButton");
		velocity = max_velocity;
		heading = heading - 180;
		updateRoll();
		if (ev.preventDefault) ev.preventDefault();
		return false;
	}
}

function onUp(ev) {
	if (ev.which) {
		ev.preventDefault = function() {};
		if (ev.which == 37) { ev.target = $("#leftButton")[0]; }
		if (ev.which == 38) { ev.target = $("#driveButton")[0]; }
		if (ev.which == 39) { ev.target = $("#rightButton")[0]; }
		if (ev.which == 40) { ev.target = $("#reverseButton")[0]; }
		keys[ev.which] = "up";
	} 
	if (ev.target.id == "rightButton") {
		$(ev.target).removeClass("selectedTouchButton");
		headingDelta = 0;
		updateRoll();
	} else if (ev.target.id == "leftButton") {
		$(ev.target).removeClass("selectedTouchButton");
		headingDelta = 0;
		updateRoll();
	} else if (ev.target.id == "driveButton") {
		$(ev.target).removeClass("selectedTouchButton");
		velocity = 0;
		updateRoll();
	} else if (ev.target.id == "reverseButton") {
		$(ev.target).removeClass("selectedTouchButton");
		heading = heading + 180;
		velocity = 0;
		updateRoll();
	}
}

$(function(){
	FastClick.attach($("#leftButton")[0]);
	FastClick.attach($("#rightButton")[0]);
	FastClick.attach($("#driveButton")[0]);
	FastClick.attach($("#startTripButton")[0]);
	FastClick.attach($("#stopTripButton")[0]);

	$("#picker").slider({ 
		tooltip: "hide"
	}).on("change", pickerChange).data("slider");

	$("#speedSlider").slider({ 
		tooltip: "hide"
	}).on("change", speedChange).data("slider");

	$("body").on("mousedown", onDown);
	$("body").on("keydown", onDown);
	$("body").on("touchstart", onDown);

	$("body").on("mouseup", onUp);
	$("body").on("keyup", onUp);
	$("body").on("touchend", onUp);
	$("body").on("touchcancel", onUp);

	loadDeviceList();

	$("#chariotSelect").change(function() {
		if (this.value == "") return;
		if (deviceId) {
			disconnect();
		}
		deviceId = this.value;
		if (!connected) { connect(); }
		else {
			setTimeout(subscribe, 200);
		}
	});

	$("#startTripButton").on("click", function() {
		$("#startTripButton").attr("disabled", "disabled");
		$("#stopTripButton").attr("disabled", false);
		$("#scoreDisplay").fadeIn();
		startTripRequest();
	});
	$("#stopTripButton").on("click", function() {
		$("#stopTripButton").attr("disabled", "disabled");
		$("#startTripButton").attr("disabled", false);
		stopTripRequest();
	});
});

function pickerChange(event) {
	var perc = event.value.newValue / 256;
	var bucket = Math.floor(perc * 6);
	var bucket_perc = (perc - (bucket / 6)) * 6;
	var r = 0, g = 0, b = 0;
	if (bucket == 0) {
		r = 255, g = bucket_perc * 255, b = 0;
	} else if (bucket == 1) {
		r = 255 - bucket_perc * 255, g = 255, b = 0;
	} else if (bucket == 2) {
		r = 0, g = 255, b = bucket_perc * 255;
	} else if (bucket == 3) {
		r = 0, g = 255 - bucket_perc * 255, b = 255;
	} else if (bucket == 4) {
		r = bucket_perc * 255, g = 0, b = 255;
	} else if (bucket == 5) {
		r = 255, g = 0, b = 255 - bucket_perc * 255;
	}
	updateColor(r, g, b);
	r = Math.floor(r);
	g = Math.floor(g);
	b = Math.floor(b);
	$("#swatch").css("background-color", "rgb("+r+","+g+","+b+")");
	console.log(r, g, b);
}

function speedChange(event) {
	max_velocity = event.value.newValue;
	console.log("new speed: " + max_velocity);
	$("#speed").html(Math.floor(max_velocity * 100) + "%");
}

setInterval(function() {
	if (headingDelta != 0) {
		heading += headingDelta;
		updateRoll(); 
	}
}, 100);

$('#picker').colorpicker().on('changeColor', function(ev){
	var rgb = ev.color.toRGB();
	console.log(rgb);
	updateColor(rgb.r, rgb.g, rgb.b);
});

var pictures = {};
function addPicturePiece(msgId, index, max, data) {
	if (!pictures[msgId]) {
		pictures[msgId] = new Array();
	}
	pictures[msgId][index] = data;
	if (pictures[msgId].length == max + 1) {
		processPicture(msgId);
	}
}

function processPicture(msgId) {
	//console.log("processPicture("+msgId+")");
	var data = "";
	for (var i in pictures[msgId]) {
		data += pictures[msgId][i];
	}
	data = data.replace(/\s+/g, '');
	$("#picture").prop("src", "data:image/png;base64,"+data);
	delete pictures[msgId];
}

var telemetry = {};
var collisions = {};

var lastTelemetry = null;
var lastCollision = null;

function addTelemetry(data) {
	telemetry[(new Date()).getTime()] = data;
	var max = Math.max(Math.abs(data.x), Math.abs(data.y));
	if (max > minimap.view.max.x) {
		minimap.view.min.x = -1*max;
		minimap.view.max.x = max;
		minimap.view.min.y = -1*max;
		minimap.view.max.y = max;
		minimap.view.step = 50 * Math.ceil(max / 200);
	}
}

function addCollision(data) {
	collisions[(new Date()).getTime()] = data;
}

client.onMessageArrived = function(msg) {
	var topic = msg.destinationName;
	var data = msg.payloadString;
	//console.log(msg.destinationName, msg.payloadString);
	var eventType = topic.split("/")[6];
	if (eventType == "collision") {
		console.log(msg.payloadString);
		var d = JSON.parse(data).d;
		addCollision({
			x: d.impact_position_x,
			y: d.impact_position_y
		});
		$("#headingCircle").attr("fill", "red");
		setTimeout(function() { 
			$("#headingCircle").attr("fill", "none");
		}, 100);
	} else if (eventType == "telemetry") {
		var d = JSON.parse(data).d;
		d.speed = Math.sqrt(d.vx * d.vx + d.vy * d.vy);
		addTelemetry(d);
		lastTelemetry = d;
		console.log(d);
	} else if (eventType == "setColor") {
		var d = JSON.parse(data).d;
		console.log(d);
		d.r = Math.floor(d.r);
		d.g = Math.floor(d.g);
		d.b = Math.floor(d.b);
		$("#positionCursor").attr("stroke", "rgb("+d.r+","+d.g+","+d.b+")");
		$("#headingCursor").attr("stroke", "rgb("+d.r+","+d.g+","+d.b+")");
		$("#velocityLine2").attr("stroke", "rgb("+d.r+","+d.g+","+d.b+")");
		$("#positionCursor").attr("fill", "rgb("+d.r+","+d.g+","+d.b+")");
		$("#headingCursor").attr("fill", "rgb("+d.r+","+d.g+","+d.b+")");
	} else if (eventType == "tripScore") {
		var score = JSON.parse(data).value;
		$("#scoreValue").html(Math.round(score));
	} else if (eventType == "pictureData") {
		//console.log(msg.destinationName, msg.payloadString);
		var d = JSON.parse(data).d;
		addPicturePiece(d.msgId, d.index, d.max, d.data);
	}
}

var connected = false;
client.onConnectionLost = function() {
	console.log("connection lost, reconnecting...");
	connected = false;
	if (deviceId) {
		connect();
	}
}

function MiniMap(domId) {
	this.domId = domId;
	this.bounds = {
		w: parseFloat($("#"+domId).attr("width")),
		h: parseFloat($("#"+domId).attr("height")),
		midX: parseFloat($("#"+domId).attr("width")) / 2,
		midY: parseFloat($("#"+domId).attr("height")) / 2
	};
	this.view = {
		min: { x: -100, y: -100 },
		max: { x: 100, y: 100 },
		step: 50
	};
}
var minimap = new MiniMap("mapSvg");

MiniMap.prototype.getViewCoord = function(worldCoord) {
	return {
		x: this.bounds.w * (worldCoord.x - this.view.min.x) / (this.view.max.x - this.view.min.x),
		y: this.bounds.h * (this.view.max.y - worldCoord.y) / (this.view.max.y - this.view.min.y),
	}
}

MiniMap.prototype.draw = function(telemetry, collisions) {
	/*
	this.drawBounds();
	this.drawAxes();
	this.drawLocation();
	this.drawHistory(telemetry);
	this.drawCollisions(collisions);
	$("#"+this.domId).html($("#"+this.domId).html());
	*/
}

MiniMap.prototype.drawBounds = function() {
	// draw rect
	$("#"+this.domId+" .boundingRect").attr("width", this.bounds.w);
	$("#"+this.domId+" .boundingRect").attr("height", this.bounds.h);
}

MiniMap.prototype.drawAxes = function() {
	$("#"+this.domId+" .xaxis").attr("x1", 1);
	$("#"+this.domId+" .xaxis").attr("x2", this.bounds.w-2);
	$("#"+this.domId+" .xaxis").attr("y1", this.bounds.h / 2);
	$("#"+this.domId+" .xaxis").attr("y2", this.bounds.h / 2);

	$("#"+this.domId+" .yaxis").attr("x1", this.bounds.w / 2);
	$("#"+this.domId+" .yaxis").attr("x2", this.bounds.w / 2);
	$("#"+this.domId+" .yaxis").attr("y1", 1);
	$("#"+this.domId+" .yaxis").attr("y2", this.bounds.h- 2);

	// clear all x tics
	$("#"+this.domId+" .xtic").remove();
	// draw x tics
	for (var y = this.view.min.y; y <= this.view.max.y; y++) {
		if (y % this.view.step == 0 && y != 0) {
			var viewCoord1 = this.getViewCoord({ x: this.view.min.x, y: y });
			var viewCoord2 = this.getViewCoord({ x: this.view.max.x, y: y });
			var html = "<line class='xtic' x1='"+viewCoord1.x+"' x2='"+viewCoord2.x+"' y1='"+viewCoord1.y+"' y2='"+viewCoord2.y+"' stroke='#eee' stroke-width='2' />";
			$("#"+this.domId+" .yaxis").after(html);
		}
	}

	// clear all y tics
	$("#"+this.domId+" .ytic").remove();
	// draw y tics
	for (var x = this.view.min.x; x <= this.view.max.x; x++) {
		if (x % this.view.step == 0 && x != 0) {
			var viewCoord1 = this.getViewCoord({ x: x, y: this.view.min.y });
			var viewCoord2 = this.getViewCoord({ x: x, y: this.view.max.y });
			var html = "<line class='ytic' x1='"+viewCoord1.x+"' x2='"+viewCoord2.x+"' y1='"+viewCoord1.y+"' y2='"+viewCoord2.y+"' stroke='#eee' stroke-width='2' />";
			$("#"+this.domId+" .yaxis").after(html);
		}
	}
}

MiniMap.prototype.drawLocation = function() {
	if (lastTelemetry) {
		var viewCoord = this.getViewCoord(lastTelemetry);
		console.log(viewCoord);
		$("#"+this.domId+" .positionCursor").attr("cx", viewCoord.x);
		$("#"+this.domId+" .positionCursor").attr("cy", viewCoord.y);
	}
}

MiniMap.prototype.drawHistory = function(telemetry) {
}

MiniMap.prototype.drawCollisions = function(collisions) {
	// clear all collisions
	$("#"+this.domId+" .collision").remove();
	// draw collision
	for (var i in collisions) {
		var viewCoord = this.getViewCoord({ x: collisions[i].x, y: collisions[i].y });
		var html = "<circle class='collision' cx='"+viewCoord.x+"' cy='"+viewCoord.y+"' stroke='#a00' r='3' />";
		$("#"+this.domId+" .positionCursor").before(html);
	}
}

function updateMap() {
	minimap.draw(telemetry, collisions);
}

setInterval(updateMap, 100);

function connect() {
	client.connect({
		userName: iot_username,
		password: iot_password,
		useSSL: (document.location.protocol == "https:" ? true : false),
		onSuccess: function() { 
			console.log("connected!");
			connected = true;
			subscribe();
		},
		onFailure: function() {
			console.log("failed to connect!");
		}
	});
}

function subscribe() {
	client.subscribe("iot-2/type/" + iot_deviceType + "/id/"+deviceId+"/evt/+/fmt/+");
	console.log("subscribed to iot-2/type/" + iot_deviceType + "/id/"+deviceId+"/evt/+/fmt/+");
	client.subscribe("iot-2/type/" + iot_deviceType + "/id/"+deviceId+"/cmd/+/fmt/+");
	console.log("subscribed to iot-2/type/" + iot_deviceType + "/id/"+deviceId+"/cmd/+/fmt/+");
}
function disconnect() {
	client.unsubscribe("iot-2/type/" + iot_deviceType + "/id/"+deviceId+"/evt/+/fmt/+");
	client.unsubscribe("iot-2/type/" + iot_deviceType + "/id/"+deviceId+"/cmd/+/fmt/+");
}

function takePicture() {
	var msg = new Messaging.Message("");
	msg.destinationName = "iot-2/type/" + iot_deviceType + "/id/"+deviceId+"/cmd/takePicture/fmt/json";
	client.send(msg);
}

function updateColor(r, g, b) {
	var payload = JSON.stringify({ d: { r: r, g: g, b: b }});
	var msg = new Messaging.Message(payload);
	msg.destinationName = "iot-2/type/" + iot_deviceType + "/id/"+deviceId+"/cmd/setColor/fmt/json";
	client.send(msg);
}

var currentTripId = null;
function startTripRequest() {
	if (currentTripId != null) { return; }
	currentTripId = Math.floor(Math.random() * 1000000);
	var payload = JSON.stringify({ tripId: currentTripId, driverId: "v1", time: (new Date()).getTime() });
	var msg = new Messaging.Message(payload);
	msg.destinationName = "iot-2/type/" + iot_deviceType + "/id/"+deviceId+"/evt/startTripRequest/fmt/json";
	client.send(msg);
	console.log(msg.destinationName, msg.payloadString);
}

function stopTripRequest() {
	if (currentTripId == null) { return; }
	var payload = JSON.stringify({ tripId: currentTripId, driverId: "v1", time: (new Date()).getTime() });
	var msg = new Messaging.Message(payload);
	msg.destinationName = "iot-2/type/" + iot_deviceType + "/id/"+deviceId+"/evt/stopTripRequest/fmt/json";
	client.send(msg);
	console.log(msg.destinationName, msg.payloadString);
	currentTripId = null;
}

function updateRoll() {
	if (heading < 0) { heading += 360; }
	if (heading > 360) { heading -= 360; }
	//$("#heading").html(heading + "&deg;");
	var r_c = 70, r_l = 70 * velocity;
	var x_c = 75 - Math.cos((heading + 90) / 180 * Math.PI) * r_c;
	var y_c = 75 - Math.sin((heading + 90) / 180 * Math.PI) * r_c;
	var x_l1 = 75 - Math.cos((heading + 90) / 180 * Math.PI) * r_c;
	var y_l1 = 75 - Math.sin((heading + 90) / 180 * Math.PI) * r_c;
	var x_l2 = 75 - Math.cos((heading + 90) / 180 * Math.PI) * r_l;
	var y_l2 = 75 - Math.sin((heading + 90) / 180 * Math.PI) * r_l;
	$("#headingCursor").attr("cx", x_c);
	$("#headingCursor").attr("cy", y_c);
	$("#velocityLine1").attr("x2", x_l1);
	$("#velocityLine1").attr("y2", y_l1);
	$("#velocityLine2").attr("x2", x_l2);
	$("#velocityLine2").attr("y2", y_l2);
	console.log("updateRoll -- " + heading + ", " + velocity);
	var payload = JSON.stringify({ d: { heading: heading, velocity: velocity }});
	var msg = new Messaging.Message(payload);
	msg.destinationName = "iot-2/type/" + iot_deviceType + "/id/"+deviceId+"/cmd/setRoll/fmt/json";
	client.send(msg);
}

function resetOrigin() {
	var payload = "";
	var msg = new Messaging.Message(payload);
	msg.destinationName = "iot-2/type/" + iot_deviceType + "/id/"+deviceId+"/cmd/setOrigin/fmt/json";
	client.send(msg);
}

$("#reset").on("click", function() { resetOrigin(); });
