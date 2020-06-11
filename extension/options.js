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

function updateElement(id,key, fix) {
    let e = document.getElementById(id);
    chrome.storage.local.get([key], function(result) {
        console.log(result)
        let c = result[key];
        console.log("Got %s for %s", c, key)
        if (fix) {
            c = fix(c);
        }
        e.textContent = c; // for P
        e.value = c; // for input
    });
}

function render() {
    updateElement("server_url", "server_url");
    updateElement("hostname", "hostname");
    updateElement("alertThreshold", "alertThreshold");


//    updateElement("last_timestamp", "last_timestamp", (f) => { return new Date(parseInt(f)); });
  //  updateElement("last_message", "last_message");
}

function saved() {
        // Update status to let user know options were saved.
        var status = document.getElementById('status');
        status.textContent = 'Options saved.';
        setTimeout(function() {
          status.textContent = '';
        }, 750);
}

function saveOnEvent(id, key) {
    let e = document.getElementById(id);
    e.addEventListener("change", function(event) {
        let s = {};
        s[key] = e.value;
        chrome.storage.local.set(s,
            function () { console.log("set %s to %s", key, e.value); })
        saved();
    })
}

function onloader() {
    render(); 

    saveOnEvent("server_url", "server_url");
    saveOnEvent("hostname", "hostname");
    saveOnEvent("alertThreshold", "alertThreshold");
}  
document.addEventListener('DOMContentLoaded', onloader);