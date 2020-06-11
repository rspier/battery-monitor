
default:
	@echo "Try: make extension.zip" 

server.bin: server/*.go server/go.*
	cd server && go build -o ../server.bin .

extension.zip: extension/*
	cd extension && zip -9 ../extension.zip *

# TODO: finish hooking up the oauth magic for this
# https://developer.chrome.com/webstore/using_webstore_api
APP_ID:="mceclipflnnklmpcljajjkeneghmiepn"
TOKEN:=$(file < .webstore-token)
upload: extension.zip
	curl \
	  -H "Authorization: Bearer $(TOKEN)"  \
	  -H "x-goog-api-version: 2" \
	  -X PUT \
	  -T extension.zip \
	  -v \
	  https://www.googleapis.com/upload/chromewebstore/v1.1/items/$(APP_ID)