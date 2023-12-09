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

var keys = ["hostname", "server_url"];

document.addEventListener('DOMContentLoaded', function () {
    chrome.runtime.sendMessage({
        type: 'getState',
        target: 'background',
        data: ""
    });

    let b = document.getElementById("sendnow");
    b.addEventListener("click", function (_event) {
        chrome.runtime.sendMessage({ target: "background", type: "send" });
    })

    chrome.storage.local.get(keys, function (result) {
        for (var key in result) {
            let c = result[key];
            let e = document.getElementById(key);
            if (e) {
                e.textContent = c; // for P
            }
        }
    });
});

chrome.runtime.onMessage.addListener(handleMessages);

// This function performs basic filtering and error checking on messages before
// dispatching the message to a more specific message handler.
async function handleMessages(message) {
    // Return early if this message isn't meant for the background script
    if (message.target !== 'popup') {
        return;
    }
    // Dispatch the message to an appropriate handler.
    switch (message.type) {
        case 'state':
            document.getElementById("json").innerHTML = JSON.stringify(message.data);
            break;
        default:
            console.warn(`Unexpected message type received: '${message.type}'.`);
    }
}

document.addEventListener('DOMContentLoaded', function (e) {

})