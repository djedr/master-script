var bindings = {
    "directory": {

    },
    "absolute-paths": {

    },
    "drives": {
        "list": true
    },
    "selected": {
        "event-handlers": {
            "dblclick": function() {
                var obj = { selected: bindings["selected"].node.value };
                websocket.send(JSON.stringify(obj));
            },
            "change": function() {
                bindings["file-filter"].node.value = "";
            }
        }
    },
    "files": {
        "list": true
    },
    "file-filter": {
        "event-handlers": {
            "input": function() {
                var phrase = bindings["file-filter"].node.value;
                var children = bindings["selected"].node.children;
                var text = "";
                var child;
                for (var i = 0; i < children.length; ++i) {
                    child = children[i];
                    text = child.textContent;
                    if (text !== ".." && text !== "." && text.indexOf(phrase) === -1) {
                        child.style.display = "none";
                    } else {
                        child.style.display = "block";
                    }
                }
            }
        }
    },
    "open-button": {
        "event-handlers": {
            "click": function() {
                localStorage.setItem('current-project', bindings["directory"].data);

                var obj = { open: true };
                websocket.send(JSON.stringify(obj));
            }
        }
    },
    "test-button": {
        "event-handlers": {
            "click": function() {
                localStorage.setItem('test', bindings["directory"].data);
                websocket.send("test websocket message");
            }
        }
    },
    "directory-input": {
        "attr": "value",
        "data-from": "directory"
    },
    "error": {

    }
};

//
// basic event listeners
//
// this could be added automatically when including data-binding
addEventListener('load', function() {
    bindNodes(bindings, document);
});
addEventListener('message', function (event) {
    console.log('message', event);
});
addEventListener('storage', function(event) {
    console.log('storage', event);
});

//
// communication with back-end
//
var websocket = new WebSocket("ws://localhost:8080", "dual-protocol");

websocket.onopen = function(event) {
    console.log("opened websocket");
    websocket.send('websocket initiated'); // important to send this
};

websocket.onmessage = function(event) {
    var msg = event.data;

    if (msg[0] === '{') {
        updateBindings(bindings, JSON.parse(msg));
    }
    console.log('websocket message', event.data);
};