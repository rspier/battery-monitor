/*
Copyright 2020 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// set defaults that will be overwridden by real values
var config = {previousLevel: -1, alertThreshold: -1};

const alarmName = "ticker";

var canvasElem = document.createElement('canvas')
var canvas = canvasElem.getContext("2d");
canvasElem.width = 32;
canvasElem.height = 32;

function setIcon(value) {
  canvas.clearRect(0, 0, canvasElem.width, canvasElem.height);

  canvas.fillStyle = "#000";
  canvas.font = "29px 'Roboto'";
  canvas.fillText("" + value, 0, 28, 28);

  chrome.browserAction.setIcon(
    { imageData: canvas.getImageData(0, 0, 32, 32) });
}

var status = {};
var source;


// https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
async function postData(url = '', data = {}) {
  // Default options are marked with *
  const response = await fetch(url, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    mode: 'no-cors', // no-cors, *cors, same-origin
    cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    credentials: 'omit', // include, *same-origin, omit
    headers: {
      'Content-Type': 'application/json'
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: 'follow', // manual, *follow, error
    referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    body: JSON.stringify(data) // body data type must match "Content-Type" header
  });
  return response; // parses JSON response into native JavaScript objects
}

var lastPost = 0;

function update() {
  navigator.getBattery().then(b => updateStatus(b));
}

function updateStatus(battery) {
  let level = battery.level * 100;
  if (level != config.previousLevel
    && level <= config.alertThreshold 
    && battery.charging == false
    && (config.alertThreshold - level) % 5 == 0)  {

    var opt = {
      type: "progress",
      title: "Battery Low",
      message: `Battery at ${level}%`,
      iconUrl: "icon128.png",
      progress: level,
    }
    chrome.notifications.create(null, opt, null);
  }
  chrome.storage.local.set({previousLevel: level});

  let server_url = config["server_url"];
  if (!server_url) {
    return null;
  }


  let status = {
    hostname: config.hostname,
    charging: battery.charging,
    chargingTime: battery.chargingTime,
    dischargingTime: battery.dischargingTime,
    level: battery.level * 100,
  }
  setIcon(status.level)
  console.log(JSON.stringify(status));

  let now = new Date().getTime() / 1000;
  //  if (now - lastPost < 60) { // no more often than every 60 seconds.
  //    return
  //  }
  lastPost = now
  // status doesn't need to be a global if we're just posting it and not making it available otherwise.
  //    postData("http://giraffe.lan:7088/post", status)
  console.log(status)
  postData(server_url, status)


}



setIcon("?");

/* chrome.management.getSelf(
  function (self) {
    console.log("initialized " + self.name + " " + self.version);
  });
}
 */
// setup the config and then call setup
chrome.storage.local.get(["hostname", "server_url", "alertThreshold", "previousLevel"], function (result) {
  config = result;
});

// Consider passing config into the closure of the event handlers instead of it being a global.

// Listeners must be at the top-level to activate the background script if an important event is trigger
// https://developer.chrome.com/extensions/background_migration



// This doesn't work because the addEventListners aren't at the top level.
// There's no way to get battery at the top level of the script, because
// getBattery() returns a promise, and await only works inside async functions.
/* 
navigator.getBattery().then(function (battery) {
 battery.addEventListener('chargingchange', function () { updateStatus(battery); })
 battery.addEventListener('levelchange', function () { updateStatus(battery); })
 battery.addEventListener('chargingtimechange', function () { updateStatus(battery); })
 battery.addEventListener('dischargingtimechange', function () { updateStatus(battery); })
}
*/



function handleAlarm(alarm) {
  if (alarm.name != alarmName) {
    return;
  } 
  console.log(alarm)
  update()
}

chrome.alarms.onAlarm.addListener(handleAlarm);
chrome.storage.onChanged.addListener(function (changes, _) {
  for (var key in changes) {
    var storageChange = changes[key];
    config[key] = storageChange.newValue;
  }
});

chrome.runtime.onMessage.addListener(
  function (request, _sender, _sendResponse) {
    console.log("request.action: %s", request.action)
    if (request.action == "send") {
      navigator.getBattery().then(function (battery) {
        updateStatus(battery);
      })
    }
  });

chrome.alarms.create(alarmName, { periodInMinutes: 1 });

console.log("initialized")