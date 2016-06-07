// 'use strict';

// // const
// //     spawn = require('child_process').spawn,
// //     main_server = spawn('http-server', ['-p', '8081']),
// //     project_manager = spawn('chrome.exe', ['localhost:8081']);

const http = require('http');
const opn = require('opn');
const spawn = require('child_process').spawn;
const stripAnsi = require('strip-ansi');
const fs = require('fs');
const drivelist = require('drivelist');
const WebSocketServer = require('websocket').server;
const WebSocketClient = require('websocket').client;

var optionsFileName = 'server-options.json';
var optionsDefaults = {
    "host": "127.0.0.1",
    "websocket port": 8080,
    "editor port": 8081,
    "initial project port": 8082, // note: this won't be necessary probably, since node can read the filesystem alright
    "browser": "chrome",
    "cors": true
}

var optionsFile = fs.openSync(optionsFileName, 'a+');
var contents = fs.readFileSync(optionsFile).toString("utf8");
if (contents === "") {
    contents = JSON.stringify(optionsDefaults);
    fs.writeFileSync(optionsFile, contents);
}
var options = Object.assign({}, optionsDefaults, JSON.parse(contents));
console.log(options);
fs.closeSync(optionsFile);

var port = options["websocket port"];
var host = options["host"];
var corsParam = options["cors"]? '--cors': "";
var browserParam = options["browser"];
var editorPortParam = options["editor port"];
var projectPortParam = options["initial project port"];

var websocketProtocol = "dual-protocol";

var httpServerPath = 'node.exe ./node_modules/http-server/bin/http-server';

var directory = __dirname;
var client = new WebSocketClient();

const manager = spawn(httpServerPath, [corsParam, '-p', editorPortParam], { shell: true });// { stdio: 'inherit' });
var init = {
    "host": host,
    "port": port,
    "protocol": websocketProtocol
};
opn(`http://${host}:${editorPortParam}/index.html#${JSON.stringify(init)}`, { app: browserParam });

var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received websocket request for ' + request.url);
    response.writeHead(404);
    response.end();
});

server.listen(port, host);
console.log('Listening at http://' + host + ':' + port);

var wsServer = new WebSocketServer({
    httpServer: server,
    // You should not use autoAcceptConnections for production
    // applications, as it defeats all standard cross-origin protection
    // facilities built into the protocol and the browser.  You should
    // *always* verify the connection's origin and decide whether or not
    // to accept it.
    autoAcceptConnections: false
});

var drives = null;//[__dirname.slice(0, 2)];

wsServer.on('request', function(request) {
    var connection = request.accept(websocketProtocol, request.origin);
    console.log((new Date()) + ' Connection accepted.');

    if (!drives) {
        drivelist.list(function(error, disks) {
            if (error) throw error;
            drives = disks.map((disk) => {
                return disk.mountpoint;
            });
            connection.sendUTF(JSON.stringify({ drives: drives }));
        });
    }


    function sendUpdatedListing(newDirectory) {
        try {
            if (fs.lstatSync(newDirectory).isDirectory()) {
                directory = newDirectory;

                fs.readdir(directory, function(err, files) {
                    if (err) return;
                    var error = "";

                    files = files.filter((file) => {
                        try {
                            return fs.lstatSync(directory + "/" + file).isDirectory();
                        } catch (e) {
                            //error = `not: ${file}`;
                            //console.log(e);
                            return false;
                        }
                    });

                    connection.sendUTF(JSON.stringify({
                        directory: directory,
                        files: [
                            directory.search(/\\|\//) === -1? "." : "..",
                            ...files
                        ],
                        //drives: drives,
                        error: error,
                        ".option": options,
                        //options: options,
                        //optionsDefaults: optionsDefaults // note: this should be sent only on init
                    }));

                    return;
                });
            } else {
                connection.sendUTF({ "error": "not a directory" });
            }
        } catch (e) {
            connection.sendUTF({ "error": "possibly not a directory" });
        }
    }

    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            var msg = message.utf8Data;

            if (msg[0] === "{") {
                var obj = JSON.parse(msg);
                var selected = obj["selected"];
                var open = obj["open"];
                var path = obj["pathToRead"];
                var fileToSave = obj["fileToSave"];
                var newOptions = obj["options"];
                var command = obj["command"];
                var newDirectory = "";

                if (selected && selected != ".") {
                    if (selected === "..") {
                        var index = directory.lastIndexOf("\\");
                        if (index !== -1 || (index = directory.lastIndexOf("/")) !== -1) {
                            newDirectory = directory.slice(0, index);
                        }
                    } else {
                        newDirectory = directory + "/" + selected;
                    }

                    sendUpdatedListing(newDirectory);
                }

                if (path) {
                    console.log(fs.readFile(path, function (error, contents) {
                        if (error) throw error;
                        connection.sendUTF(JSON.stringify({
                            fileContents: contents.toString("utf8")
                        }));
                    }));
                }

                if (fileToSave) {
                    fileToSave = JSON.parse(fileToSave);
                    fs.writeFile(__dirname + "/" + fileToSave.path, fileToSave.contents, function (error) {
                        if (error) throw error;

                        connection.sendUTF(JSON.stringify({
                            info: "file saved"
                        }));
                    });
                }

                if (newOptions) {
                    console.log("options incoming", newOptions);
                    var updatedOptions = Object.assign({}, options, newOptions);

                    if (updatedOptions["websocket port"] === updatedOptions["editor port"] ||
                        updatedOptions["websocket port"] === updatedOptions["initial project port"] ||
                        updatedOptions["editor port"]    === updatedOptions["initial project port"]) {
                        connection.sendUTF(JSON.stringify({
                            error: "invalid ports",
                            options: options
                        }));
                    } else {
                        options = Object.assign(options, newOptions);
                        fs.writeFileSync(optionsFileName, JSON.stringify(options));
                    }
                }

                if (command) {
                    if (command === "initialize") {
                        connection.sendUTF(JSON.stringify({
                            drives: drives,
                            options: options,
                            optionsDefaults: optionsDefaults
                        }));
                        sendUpdatedListing(directory);
                    }
                }

                if (open) {
                    // serve project; each new project would get a different port
                    spawn(httpServerPath, [directory, corsParam, '-p', projectPortParam], { shell: true });// { stdio: 'inherit' });
                    // note: would need to increment projectPortParam here
                    // open editor:
                    opn(`http://${host}:${editorPortParam}/editor.html`, { app: browserParam });
                }
            } else {
                console.log("Didn't process Message: " + msg);

                // initiate:
                sendUpdatedListing(directory);
            }
        } else if (message.type === 'binary') {
            console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
            connection.sendBytes(message.binaryData);
        }
    });

    connection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });
});

client.on('connectFailed', function(error) {
    console.log('Connect Error: ' + error.toString());
});

client.on('connect', function(connection) {
    console.log('WebSocket Client Connected');
    connection.on('error', function(error) {
        console.log("Connection Error: " + error.toString());
    });
    connection.on('close', function() {
        console.log(`${websocketProtocol} Connection Closed`);
    });
    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            console.log("Received: '" + message.utf8Data + "'");
        } else {
            console.log("Received:bin");
		}
    });
});

//function spawnHttpServer () {}

fs.realpath(__dirname, function(err, path) {
    if (err) {
        console.log(err);
     return;
    }
    console.log('Path is : ' + path);
});

manager.stdout.on('data', (data) => {
    console.log("manager data:", data.toString("utf8"));
    // var str = stripAnsi(data.toString("utf8"));
    // var get = /[\s\S]*\GET \/\?([^"]*)"/g.exec(str);
    // if (get) {
    //     get = get[1];

    //     //console.log(str);
    //     //console.log(getParameters(get));
    // }
});

manager.stderr.on('data', (data) => {
  console.log(data.toString("utf8"));
});

manager.on('exit', (code) => {
  console.log(`Child exited with code ${code}`);
});