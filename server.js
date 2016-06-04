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
const mainPort = 8080;
const mainWebsocketPort = 8081;
const mainProjectPort = 8082;

var port = 8080;
var host = '127.0.0.1';

var directory = __dirname;
var HTML = "";//fs.readFileSync('project-manager.html').toString("utf8").replace(/`/g,'\\`');
var client = new WebSocketClient();

var env = Object.create(process.env);
//env.PATH += ";"+__dirname + "/node_modules/http-server/bin";
//env.PATHEXT += ";.JS;=;";
// serve main app
const manager = spawn('node.exe ./node_modules/http-server/bin/http-server', ['--cors', '-o', 'chrome', '-p', '8081'], { shell: true, env: env });// { stdio: 'inherit' });
// serve editor
//const editor = spawn('node.exe ./node_modules/http-server/bin/http-server', ['--cors', '-p', '8081'], { shell: true, env: env });// { stdio: 'inherit' });
//opn("http://127.0.0.1:8081/project-manager/index.html", { app: "chrome" });



function getParameters(str) {
    var arr = str.split("&");
    var obj = {};
    var vals = arr.map((val) => { var v = val.split('='); obj[v[0]] = v[1]; return v;  });
    return obj;
}

var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received websocket request for ' + request.url);
    response.writeHead(404);
    response.end();
});

server.listen(port, host);
console.log('Listening at http://' + host + ':' + port);
//opn("http://localhost:8080", {app:"firefox"});

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
    var connection = request.accept('dual-protocol', request.origin);
    console.log((new Date()) + ' Connection accepted.');


    if (!drives) {
        drivelist.list(function(error, disks) {
            if (error) throw error;
            drives = disks.map((disk) => {
                return disk.mountpoint;
            });
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
                        drives: drives,
                        error: error
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

                if (open) {
                    // serve project; each new project would get a different port
                    spawn('node.exe ./node_modules/http-server/bin/http-server', [directory, '--cors', '-p', '8082'], { shell: true });// { stdio: 'inherit' });
                    //spawn('cmd.exe', ['/c', `http-server ${directory} --cors -p 8082`]); //spawn('cmd.exe', ['/c', `http-server --cors -p 8081 -o`]);
                    // open editor:
                    opn("http://127.0.0.1:8081/editor.html", { app: "chrome" });
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
        console.log('echo-protocol Connection Closed');
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
    var str = stripAnsi(data.toString("utf8"));
    var get = /[\s\S]*\GET \/\?([^"]*)"/g.exec(str);
    if (get) {
        get = get[1];

        //console.log(str);
        console.log(getParameters(get));
    }
});

manager.stderr.on('data', (data) => {
  console.log(data.toString("utf8"));
});

manager.on('exit', (code) => {
  console.log(`Child exited with code ${code}`);
});