
// Set up the battery event handlers.
navigator.getBattery().then(function (battery) {
  battery.addEventListener('chargingchange', function () { batteryChanged(battery); })
  battery.addEventListener('levelchange', function () { batteryChanged(battery); })
  battery.addEventListener('chargingtimechange', function () { batteryChanged(battery); })
  battery.addEventListener('dischargingtimechange', function () { batteryChanged(battery); })
  // Send initial data
  batteryChanged(battery);
});

function batteryChanged(battery) {
  sendToBackground("battery",
    {
      charging: battery.charging,
      chargingTime: battery.chargingTime,
      dischargingTime: battery.dischargingTime,
      level: battery.level * 100,
    }
  )
}

function sendToBackground(type, data) {
  chrome.runtime.sendMessage({
    type: type,
    target: 'background',
    data: data
  });
}

chrome.runtime.onMessage.addListener(handleMessages);
async function handleMessages(message) {
    // Return early if this message isn't meant for the offscreen script
    if (message.target !== 'offscreen') {
        return;
    }
    // Dispatch the message to an appropriate handler.
    switch (message.type) {
        case 'updateBatteryState':
          navigator.getBattery().then( (b) => batteryChanged(b) );
            break;
        default:
            console.warn(`Unexpected message type received: '${message.type}'.`);
    }
}