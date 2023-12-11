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
var config = { previousLevel: -1, alertThreshold: -1 };

let MAX_POST_FREQUENCY = 60; // wait at least 60 seconds between any server updates
let MIN_POST_FREQUENCY = 5 * 60; // post every 5 minutes even if nothing changes

// The full lodash is needed because the core subset doesn't have debounce.
// Consider using a proper tree-shaking build to get a custom tiny lodash.
// TODO: we're not using debounce anymore go back to the smaller lodash
importScripts('lodash.min.js');

// global used to merge data between battery and tabs
let lastState = {};

const offscreenCanvas = new OffscreenCanvas(32, 32);
var canvas = offscreenCanvas.getContext("2d", { willReadFrequently: true });

function setIcon(value) {
  canvas.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

  canvas.fillStyle = "#000";
  canvas.font = "29px 'Roboto'";
  canvas.fillText("" + value, 0, 28, 28);

  chrome.action.setIcon(
    { imageData: canvas.getImageData(0, 0, 32, 32) });
}

let lastPostTime = 0;
async function realPostState(state) {
  // _.debounce doesn't work well over 15 seconds, we want to wait at least a minute between posts.
  let now = Date.now() / 1000;
  let lastAgo = now - lastPostTime;
  if (lastAgo < MAX_POST_FREQUENCY) { console.log('not posting more than once a minute'); return null; }

  let server_url = config["server_url"];
  if (!server_url) {
    console.log("no server specified");
    return null;
  }

  // don't post if it it hasn't changed, unless it's been 5 minutes.
  if (_.isEqual(state, lastState) && lastAgo < (MIN_POST_FREQUENCY - 1)) {
    console.log('not sending, state is the same: ', state, ' == ', lastState);
    return null;
  }

  console.log('posting state: ', state)
  let posted = await postData(server_url, state)

  lastPostTime = now;
  Object.assign(lastState, state)

  return posted
}
let postState = realPostState

// postData handles the network part of sending data to the server.
async function postData(url = '', data = {}) {
  // Default options are marked with *
  // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
  const response = await fetch(url, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    mode: 'no-cors', // no-cors, *cors, same-origin
    cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    credentials: 'omit', // include, *same-origin, omit
    headers: {
      'Content-Type': 'application/json'
    },
    redirect: 'follow', // manual, *follow, error
    referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    body: JSON.stringify(data) // body data type must match "Content-Type" header
  });
  return response;
}

async function batteryAlert(battery) {
  let level = battery.level;
  if (level != config.previousLevel // could use lastState.level ?
    && level <= config.alertThreshold
    && battery.charging == false
    && (config.alertThreshold - level) % 5 == 0) {

    var opt = {
      type: "progress",
      title: "Battery Low",
      message: `Battery at ${level}%`,
      iconUrl: "icon128.png",
      progress: level,
    }
    chrome.notifications.create(null, opt, null);
  }
  chrome.storage.local.set({ previousLevel: level });
}

setIcon("?");
// setup the config and then call setup
chrome.storage.local.get(["hostname", "server_url", "alertThreshold", "previousLevel"], function (result) {
  config = result;
});

// postUpdate posts battery and tab count information. 
async function postUpdate(battery, tabCount) {
  data = {
    charging: battery.charging,
    chargingTime: battery.chargingTime,
    dischargingTime: battery.dischargingTime,
    level: battery.level,
    hostname: config.hostname,
    tabCount: tabCount,
  }
  setIcon(data.level)
  postState(data);
}

// batteryUpdate is called when the battery levels change.  Generally it's
// triggered by handling a message from the offscreen page.
async function batteryUpdate(battery) {
  console.log('batteryUpdate');
  chrome.tabs.query({}, function (tabs) {
    postUpdate(battery, tabs.length);
  })
  batteryAlert(battery);
}

// tabsUpdate triggers when a tab is created or removed.  It triggers a battery update request which will update the stats.
async function tabsUpdate(tabs) {
  console.log('tabsUpdate');
  chrome.runtime.sendMessage({ target: "offscreen", type: "updateBatteryState" });
}
chrome.tabs.onCreated.addListener(tabsUpdate);
chrome.tabs.onRemoved.addListener(tabsUpdate);

chrome.storage.onChanged.addListener(function (changes, _) {
  for (var key in changes) {
    var storageChange = changes[key];
    config[key] = storageChange.newValue;
  }
});

async function handleAlarm(alarm) {
  console.log(`alarm: ${alarm.name}`);
  switch (alarm.name) {
    case 'periodic':
      forceUpdate();
      break;
    default:
      console.warn(`Unexpected alarm received: ${alarm.name}`);
  }
}
chrome.alarms.onAlarm.addListener(handleAlarm);


async function forceUpdate() {
  console.log('forceUpdate');
  chrome.runtime.sendMessage({ target: "offscreen", type: "updateBatteryState" });
}

// This function performs basic filtering and error checking on messages before
// dispatching the message to a more specific message handler.
async function handleMessages(message) {
  // Return early if this message isn't meant for the background script
  if (message.target !== 'background') {
    return;
  }
  // Dispatch the message to an appropriate handler.
  switch (message.type) {
    case 'battery':
      batteryUpdate(message.data);
      break;
    case 'send':
      forceUpdate();
      break;
    case 'getState':
      chrome.runtime.sendMessage({
        type: 'state',
        target: 'popup',
        data: lastState,
      });
      break;
    default:
      console.warn(`Unexpected message type received: '${message.type}'.`);
  }
}
chrome.runtime.onMessage.addListener(handleMessages);

self.addEventListener("activate", async function (e) {
  // don't have to explicitly initialize tab count, because when the battery state returns it'll happen.
  chrome.offscreen.createDocument({
    url: chrome.runtime.getURL('offscreen.html'),
    reasons: [chrome.offscreen.Reason.BATTERY_STATUS],
    justification: 'Read battery levels.',
  });

  console.log("extension activated");
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  // reason will be 'install' or 'update'
  console.log(`reason: ${reason}`);

  await chrome.alarms.clearAll();
  // Every 5 minutes, update statistics even if they haven't changed otherwise.
  chrome.alarms.create("periodic", { periodInMinutes: MIN_POST_FREQUENCY / 60 });
});

// the end