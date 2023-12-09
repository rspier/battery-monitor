
// Set up the battery event handlers.
navigator.getBattery().then(function (battery) {
  battery.addEventListener('chargingchange', function () { updateBatteryStatus(battery); })
  battery.addEventListener('levelchange', function () { updateBatteryStatus(battery); })
  battery.addEventListener('chargingtimechange', function () { updateBatteryStatus(battery); })
  battery.addEventListener('dischargingtimechange', function () { updateBatteryStatus(battery); })
  // Send initial data
  updateBatteryStatus(battery);
});


function updateBatteryStatus(battery) {
  sendToBackground("battery",
    {
      charging: battery.charging,
      chargingTime: battery.chargingTime,
      dischargingTime: battery.dischargingTime,
      level: battery.level,
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