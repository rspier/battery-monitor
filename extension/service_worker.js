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

const DEBOUNCE = 15000; // don't update server more than once a minute

// set defaults that will be overwridden by real values
var config = { previousLevel: -1, alertThreshold: -1 };

// The full lodash is needed because the core subset doesn't have debounce.
// Consider using a proper tree-shaking build to get a custom tiny lodash.
importScripts('lodash.min.js');

// global used to merge data between battery and tabs
let state = {
  hostname: "",
  charging: false,
  chargingTime: 0,
  dischargingTime: 0,
  level: 0,
  tabCount: 0,
}
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
async function realPostState() {
  let server_url = config["server_url"];
  if (!server_url) {
    console.log("no server specified");
    return null;
  }

  // always update hostname
  state.hostname = config.hostname;

  // try to hide the bug where sometimes tabCount gets reset to 0 (SW
  // reinitialized?)
  if (state.tabCount == 0) {
    console.log("tabCount is unexpectedly 0.  attempting updateTabState.")
    await updateTabState()
  }

  let now = Date.now() / 1000;
  lastAgo = now - lastPostTime;

  // don't post if it it hasn't changed, unless it's been 15 minutes.
  if (_.isEqual(state, lastState) && lastAgo < (15*3600)) {
    console.log('not sending, state is the same: ', state, ' == ', lastState);
    return null;
  }

  // _.debounce doesn't work well over 15 seconds, we want to wait at least a minute between posts.
  if (now - lastAgo < 60) { return null; }


  let posted = await postData(server_url, state)

  lastPostTime = now;
  Object.assign(lastState, state)

  return posted
}
postState = _.debounce(realPostState, DEBOUNCE, { leading: true });

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
    },
    redirect: 'follow', // manual, *follow, error
    referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    body: JSON.stringify(data) // body data type must match "Content-Type" header
  });
  return response; // parses JSON response into native JavaScript objects
}

var lastPost = 0;

function updateBatteryStatus(battery) {
  let level = battery.level * 100;
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

  state.charging = battery.charging
  state.chargingTime = battery.chargingTime
  state.dischargingTime = battery.dischargingTime
  state.level = battery.level * 100
  setIcon(state.level)

  postState()
}
setIcon("?");
// setup the config and then call setup
chrome.storage.local.get(["hostname", "server_url", "alertThreshold", "previousLevel"], function (result) {
  config = result;
});

async function updateTabs() {
  await updateTabState()
  postState()
}

async function updateTabState() {
  await chrome.tabs.query({}, function (tabs) {
    /*
    // Consider uncommenting this code if the hack in realPostState doesn't work.
    if (tabs.length == 0) {
      // There's probably always at least one tab. (What about the case where
      // all windows are closed but browser is still running?)
      console.log("No tabs found.  Uh oh.")
      return;
    }
    */
    state.tabCount = tabs.length;
  })
}
chrome.tabs.onCreated.addListener(updateTabs);
chrome.tabs.onRemoved.addListener(updateTabs);

chrome.storage.onChanged.addListener(function (changes, _) {
  for (var key in changes) {
    var storageChange = changes[key];
    config[key] = storageChange.newValue;
  }
});

self.addEventListener("activate", async function (e) {
  // setup initial tab count
  await updateTabState();

  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL('offscreen.html'),
    reasons: [chrome.offscreen.Reason.BATTERY_STATUS],
    justification: 'Read battery levels.',
  });

  console.log("extension activated");
});

chrome.runtime.onMessage.addListener(handleMessages);

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
      updateBatteryStatus(message.data);
      break;
    case 'send':
      postState();
      break;
    case 'getState':
      chrome.runtime.sendMessage({
        type: 'state',
        target: 'popup',
        data: state
      });
      break;
    default:
      console.warn(`Unexpected message type received: '${message.type}'.`);
  }
}