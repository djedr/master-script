function selectedHandler(event) {
    var obj = { selected: event.target.value };
    websocket.send(JSON.stringify(obj));
};
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
            "dblclick": selectedHandler,
            "keydown": function (event) {
                if (event.keyCode === 32 || event.keyCode === 13)
                    selectedHandler(event);
            },
            "change": function () {
                bindings["file-filter"].node.value = "";
            }
        }
    },
    "files": {
        "list": true
    },
    "file-filter": {
        "event-handlers": {
            "input": function () {
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
            "click": function () {
                localStorage.setItem('current-project', bindings["directory"].data);

                var obj = { open: true };
                websocket.send(JSON.stringify(obj));
            }
        }
    },
    "test-button": {
        "event-handlers": {
            "click": function () {
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
        "bind": function (binding, data, key, node, state) {
            if (data)
                node.textContent = "ERROR: " + data;
        }
    },
    ".option": {
        "init": function (binding, node, state) {
            var name = state.name = node.querySelector(".name").textContent.toLowerCase();
            var input = state.input = node.getElementsByTagName("input")[0];
            var revertButton = state.revertButton = node.getElementsByTagName("button")[0];

            input.addEventListener("input", getOptionHandler(name));
            input.addEventListener("change", getOptionHandler(name));

            revertButton.disabled = true;

            function bindRevert() {
                setTimeout(_ => {
                    if (bindings.optionsDefaults.data) {
                        revertButton.disabled = false;
                        revertButton.addEventListener("click", getOptionRevertHandler(name, input));
                    } else {
                        bindRevert();
                    }
                }, 1000);
            }
            bindRevert();
        },
        "bind": function (binding, data, key, node, state) {
            state.input.value = binding.data[state.name];
        }
    },
    "options": {
        list: true,
        "init": function (binding, node, state) {
            var name = state.name = node.querySelector(".name");
            var input = state.input = node.getElementsByTagName("input")[0];
            var revertButton = state.revertButton = node.getElementsByTagName("button")[0];

            node.parentNode.addEventListener("click", function (event) {
                if (event.target.matches("button")) {
                    var parent = event.target.parentNode;
                    var input = parent.getElementsByTagName("input")[0];
                    var key = parent.id.split("[")[1].slice(0, -1);

                    var defaultValue = bindings.optionsDefaults.data[key];
                    input.value = defaultValue;
                    var obj = { options: {} };
                    obj.options[key] = defaultValue;
                    console.log(obj);
                    websocket.send(JSON.stringify(obj));
                }
                if (event.target.matches("input[type=checkbox]")) {
                    var parent = event.target.parentNode;
                    var input = event.target;
                    var key = parent.id.split("[")[1].slice(0, -1);
                    var obj = {
                        options: {}
                    };
                    obj.options[key] = input.checked;
                    websocket.send(JSON.stringify(obj));
                }
            });
            node.parentNode.addEventListener("input", function (event) {
                if (event.target.matches("input")) {
                    var parent = event.target.parentNode;
                    var input = event.target;
                    var key = parent.id.split("[")[1].slice(0, -1);

                    // validate, accept or revert, save previous

                    getOptionHandler(key, input.type)(event);
                }
            });
        },
        "bind": function (binding, data, key, node, state) {
            var name = node.querySelector(".name");
            var input = node.getElementsByTagName("input")[0];
            var revertButton = node.getElementsByTagName("button")[0];

            name.textContent = key;

            if (typeof data === "boolean") {
                input.type = "checkbox";
                input.checked = data;
            } else if (typeof data === "number") {
                input.type = "number";
                if (Number.isInteger(data)) {
                    input.step = "1";
                    input.pattern = "[0-9]+";
                }
            } else {
                input.type = "text";
                input.pattern = ".*";
            }
            input.value = data;
        }
    },
    "optionsDefaults": {

    },
    "info": {
        "bind": function (binding, data, key, node, state) {
            localStorage.setItem("info", data);
            console.log('info set');
        }
    }
};

var defaultValues = {
    "browser": "chrome"
}

function getOptionHandler(name, type) {
    var timeout;

    return function (event) {
        clearTimeout(timeout);
        timeout = setTimeout(_ => {
            var obj = {
                options: {}
            };
            var value = event.target.value;
            if (type === "number") {
                value = Number(value);
            }
            obj.options[name] = value;
            websocket.send(JSON.stringify(obj));
        }, 500);
    }
}

function getOptionRevertHandler(name, input) {
    var defaultValue = bindings.optionsDefaults.data[name];
    return function (event) {
        input.value = defaultValue;
        var obj = { options: {} };
        obj.options[name] = defaultValue;
        console.log(obj);
        websocket.send(JSON.stringify(obj));
    }
}

//
// basic event listeners
//
// this could be added automatically when including data-binding
addEventListener('load', function () {
    bindNodes(bindings, document);
});
addEventListener('message', function (event) {
    console.log('message', event);
});
addEventListener('storage', function (event) {
    console.log('storage', event);

    if (event.key === "pathToRead") {
        websocket.send(JSON.stringify({ pathToRead: event.newValue }));
    } else if (event.key === "fileToSave") {
        websocket.send(JSON.stringify({ fileToSave: event.newValue }));
    }
});

var websocket;
window.onload = function () {
    var hashJSON, init;
    if (location.hash[1] === "{") {
        hashJSON = unescape(location.hash).slice(1);
        localStorage.setItem("initHash", hashJSON);
        location.hash = "#";

        history.pushState("", document.title, location.pathname + location.search);
    }

    init = JSON.parse(localStorage.getItem("initHash"));


    websocket = new WebSocket(`ws://${init.host}:${init.port}`, init.protocol);

    websocket.onopen = function (event) {
        console.log("opened websocket");
        websocket.send(JSON.stringify({ command: "initialize" })); // important to send this
    };

    websocket.onmessage = function (event) {
        var msg = event.data;
        var obj;

        if (msg[0] === '{') {
            obj = JSON.parse(msg);
            updateBindings(bindings, obj);

            if (obj["fileContents"]) {
                console.log(obj["fileContents"]);
            }
        }
    };

    websocket.onclose = function (event) {
        // kill all editors
        //window.postMessage("bye", "http://127.0.0.1:8081");
        // could also use a shared web worker -- a bit faster
        localStorage.setItem("websocket closed", Date.now());
    };
};

//
// communication with back-end
//

window.onbeforeunload = function (evt) {
    //window.postMessage("bye bye", "http://127.0.0.1:8081");
    localStorage.setItem("project manager closed", Date.now());
    //websocket.close();
};

window.addEventListener('popstate', function (event) {
    console.log("state changed", event, window.location.href);
});

var worker = new SharedWorker("src/worker.js");

worker.port.addEventListener("message", function(e) {
	console.log(e.data);
}, false);

worker.port.start();

// post a message to the shared web worker
worker.port.postMessage("project manager worker");