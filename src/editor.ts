var editor,
    editor_raw,
    doc,
    primitiveList,
    currentlySelectedExpression,
    currentPath,
    parsedProgram;

function run_() {
    console.log(evaluate(parsedProgram, Object.assign(Object.create(null), rootEnv)));
    delete parsedProgram;
}

function parse_() {
    parse(editor.getValue());
    editor.refresh();
}

function loadFile_(name) {
    readTextFile("./" + name, function (text) {
        setTimeout(_ => {
            doc.off('cursorActivity', onCursorActivity);
            doc.replaceRange(text, {line:0, ch:0}, {line:10000, ch:0});
            setTimeout(_ => {
                parse_();
                doc.on('cursorActivity', onCursorActivity);
                editor.refresh();
                hideLoading_();
            }, 1000);
        }, 1000);
    });

}

// todo: deglobalize this and others
var loadingIndicator;
var pageFrame;
var visualFrame;

function togglePage_() {
    if (pageFrame.style.display === 'block') {
        visualFrame.style.display = 'block';
        pageFrame.style.display = 'none';
        visualiser.listen();
        parse_();
    } else {
        visualFrame.style.display = 'none';
        pageFrame.style.display = 'block';
        visualiser.unlisten();
    }
}

function showLoading_() {
    loadingIndicator.style.display = "block";
}

function hideLoading_() {
    loadingIndicator.style.display = "none";
}

function mark_expression(expression, start_pos, end_pos, extra) {
    var marker =
        doc.markText(
            doc.posFromIndex(start_pos),
            doc.posFromIndex(end_pos),
            { className: (extra? extra: "argument-marker"), inclusiveRight: true }//, inclusiveLeft: true, }
        );

    marker.expression = expression;
    expression.marker = marker;
}

function setBreakpoint(editor) {
    var mark = getMarkObjAt(doc.getCursor()).mark;

    if (mark.expression.breakpoint) {
        mark.expression.breakpoint = false;
        delete mark.expression.breakpoint;
        mark.className = mark.className.replace("breakpoint", "");
    } else {
        mark.expression.breakpoint = true;
        mark.className += " breakpoint";
    }
    editor.refresh();
}

function initializePrimitiveList() {
    var elm, primitive, hints = [];
    primitiveList = document.querySelector('.primitive-list');

    elm = document.createElement('li');
    elm.innerHTML = `<!--
        --><div id="insert-raw-button" class="raw-button">insert raw</div><!--
        --><div class="cancel-button">cancel</div><!--
    -->`;
    elm.querySelector("#insert-raw-button").addEventListener('click', _ => {
        var marker_range = currentlySelectedExpression.expression.marker.find(),
            marker_range_from_index = doc.indexFromPos(marker_range.from),
            text = editor_raw.getValue(),
            prefix = currentlySelectedExpression.expression.prefix;

        if (currentlySelectedExpression.expression.type === 'word') {
            prefix = currentlySelectedExpression.expression.prefix;
        } else {
            prefix = currentlySelectedExpression.expression.operator.prefix;
        }

        text = prefix + text;

        // important to do this before replaceRange
        // this must be done, because the marker is left and right inclusive and won't be cleared when its range is removed
        currentlySelectedExpression.expression.marker.clear();
        doc.replaceRange(text, marker_range.from, marker_range.to);

        parse(text, {
            character_index: marker_range_from_index,
            expression: currentlySelectedExpression.expression,
            from_index: marker_range_from_index,
            to_index: marker_range_from_index + text.length,
            id: currentlySelectedExpression.querySelector('.argument-id').textContent
        }); // placeholders for arguments? do this completely differently?

        primitiveList.style.display = "none";
    });
    primitiveList.appendChild(elm);

    elm = document.createElement('li');
    elm.innerHTML = `<!--
        --><div class="raw-button clear-button">clear code</div><!--
        --><div class="raw-button" title="if checked, code will be cleared each time the list is reopened">autoclear<input type="checkbox" style="margin: 0;"></input></div><!--
    -->`;
    elm.querySelector('.clear-button').addEventListener('click', _ => {
        editor_raw.setValue("");
    });
    primitiveList.appendChild(elm);

    elm = document.createElement('li');
    elm.innerHTML = `<!--
        --><div class="raw-button">?</div><!--
        --><div class="raw-button" title="if checked, code will not be directly editable">read only<input type="checkbox" style="margin: 0;"></input></div><!--
    -->`;
    primitiveList.appendChild(elm);

    elm = document.createElement('li');
    elm.className = "raw-input";
    elm.innerHTML = `<textarea></textarea>`;
    primitiveList.appendChild(elm);

    editor_raw = CodeMirror.fromTextArea(elm.getElementsByTagName("textarea")[0], {
        lineNumbers: true,
        placeholder: "Type code here.\nCtrl-Space autocompletes.",
        extraKeys: { "Ctrl-Space": "autocomplete", "Ctrl-B": setBreakpoint },
        autofocus: true,
        styleActiveLine: true,
        matchBrackets: true,
        theme: 'zenburn'
    });

    editor_raw.setSize("40ex", "7em");

    for (entry in rootEnv) {
        // if (!rootEnv[entry] || rootEnv[entry].type !== "[primitive]") {
        //     continue;
        // }
        var primitive = entry;
        var text = primitive,
            args = "",
            //argNames = specialFormsArgumentNames[primitive],
            i;

        // if (argNames) {
        //     for (i = 0; i < argNames.length; ++i) {
        //         args += `_${argNames[i]} `;
        //     }
        //     args = args.slice(0, -1);
        // } else {
            args += `_`;
        // }
        text += `[${args}]`;

        hints.push({ text: text, displayText: primitive });
    }

    CodeMirror.registerHelper("hint", "dual", function(editor, options) {
        var cur = editor_raw.getCursor();
        return { list: hints, from: cur, to: cur };
    });
    // CodeMirror.registerHelper("hintWords", "dual", hints);

    primitiveList.querySelector('.cancel-button').addEventListener('click', _ => {
        primitiveList.style.display = "none";
    });
}

function displayPrimitiveList(event) {
    var rect = event.target.getBoundingClientRect();
    console.log(event.target);
    event.stopPropagation();

    currentlySelectedExpression = event.target;
    while (currentlySelectedExpression.tagName !== "TR") {
        currentlySelectedExpression = currentlySelectedExpression.parentElement;
    }

    primitiveList.style.display = "block";
    primitiveList.style.position = "absolute";
    primitiveList.style.zIndex = "10";
    primitiveList.style.top = (rect.top | 0) + "px";
    primitiveList.style.left = (rect.left | 0) + "px";
    editor_raw.refresh();
    editor_raw.execCommand("autocomplete");
}
argument_event_listener = displayPrimitiveList;

function ep (prog) {
    return evaluate(parse(prog), {});
}

function execute_and_visualise() {
    var to_parse = editor.getValue();
    var parsed = parse(to_parse);
    var evaluated = evaluate(parsed.expression, {});
    var visualised = visualise_tree(parsed.tree, parsed.paths, {});

    console.log(parsed);
    console.log(visualised);

    var rootRow = document.querySelector('.root-call-table');
    rootRow.innerHTML = `<td class="input-connection-cell"></td>${visualised}`;
    //ep('log\'[' + evaluated + '\n<hr style=\'border: none; border-top: 1px solid #000;\' />' + ']');
    //console.log(JSON.stringify(parsed));
}

function getMarkObjAt(position, offset = 0) {
    var token,
        marks,
        mark,
        min,
        expression,
        vicinity,
        index,
        prevPos,
        nextPos;
    // token: Object { start: 18, end: 19, string: "[", type: "bracket", state: Object }

    index = doc.indexFromPos(position);
    prevPos = doc.posFromIndex(index - 1);
    nextPos = doc.posFromIndex(index + 1);
    vicinity = doc.getRange(prevPos, nextPos);
    console.log('range:', `"${vicinity}"`);

    // todo: cursor @ EOF
    // todo: meta {} and stuff like [{}] and ]]
    // vicinity === "[{" ->

    if (vicinity[1] && vicinity[1].search(/\s/) !== -1) { // vicinity.search(/\S\s/)
        position = prevPos;
    }

    if (vicinity !== "[{" && vicinity[0].search(/\[|\]|\{|\}/) !== -1) { // or just .search(/\]|\}/)
        position = nextPos;
    }

    marks = doc.findMarksAt(position).filter(function (item) {
        return item.className === 'argument-marker';
    });

    // picking shortest possible marker at given position
    // bound with expression with a name that matches current token
    min = Infinity;
    var current = 0, ft;
    for (var i = 0; i < marks.length; ++i) {
        ft = marks[i].find();
        current = doc.indexFromPos(ft.to) - doc.indexFromPos(ft.from);
        if (current < min) {
            min = current;
            mark = marks[i];
        }
    }

    console.log(mark);
    //mark.className = "red-back";
    //mark.css = "z-index: 100; position: absolute; top: 0; left: 0; color: red";

    return { mark, offset };
}

function onCursorActivity(doc) {
    var mark = getMarkObjAt(doc.getCursor()).mark;

    if (currentlySelectedExpression) {
        currentlySelectedExpression.style.opacity = "1";
        currentlySelectedExpression.expression.marker.css = "";
        currentlySelectedExpression.expression.marker.changed();

        currentlySelectedExpression = mark.expression.node;
        currentlySelectedExpression.style.opacity = "0.5";
    }

    mark.css = "opacity: 1; background-color: rgba(255, 255, 255, 0.1)";
    editor.refresh();
}

window.addEventListener('message', function(event) {
    if (event.origin === "http://127.0.0.1:8081") {
	   console.log("\n\n\n\n\nMESSAGE:", event.data, "/MESSAGE\n\n\n\n\n");
       localStorage.setItem("testing", event.data);
       localStorage.setItem("rand", "" + Math.random());
    }
});


window.addEventListener('storage', function(event) {
    console.log('editor storage', event);
});

var worker = new SharedWorker("src/worker.js");

worker.port.addEventListener("message", function(e) {
	console.log(e.data);
}, false);

worker.port.start();
worker.port.postMessage("editor worker");

window.addEventListener("load", function () {
    var consoleInput = document.querySelector("#console-input");

    loadingIndicator = document.querySelector('#loading-indicator');
    pageFrame = document.querySelector('#page');
    visualFrame = document.querySelector('#visual-representation');

    if (window.self !== window.top) {
        document.head.innerHTML = `<meta http-equiv="content-type" content="text/html; charset=UTF-8">`;
        document.body.innerHTML = "<h1>this is here only to capture messages</h1>";
        return;
    }

    function getNativeExecCommandHandler(command) {
        return function () {
            editor.focus();
            if (document.execCommand(command) === false) {
                alert("Your browser doesn't allow or support this option!");
            }
        }
    }
    function getEditorExecCommandHandler(command) {
        return function () {
            editor.focus();
            if (editor.execCommand(command) === false) {
                alert("Your browser doesn't allow or support this option!");
            }
        }
    }

    var editorCommands = {
        // native browser commands
        "cut": getNativeExecCommandHandler("cut"),
        "copy": getNativeExecCommandHandler("copy"),
        "paste": getNativeExecCommandHandler("paste"),
        // code mirror's commands
        "select all": getEditorExecCommandHandler("selectAll"),
        "undo": getEditorExecCommandHandler("undo"),
        "redo": getEditorExecCommandHandler("redo"),
        // dual editor commands
        "save": function () {
            editor.focus();

            var text = doc.getValue();

            // this downloads the file:
            // var a = document.createElement("a");
            // var file = new Blob([text], {type: "text/x-dual"});
            // a.href = URL.createObjectURL(file);
            // a.download = "test.dual";
            // a.click();

            localStorage.setItem("fileToSave", JSON.stringify({path: "saved.dual", contents: text}));
            //localStorage.setItem("pathToSave", "./test.dual");

            //window.open('data:text/x-dual;charset=utf-8,' + );
        }
    }



    function toggleMenu(event) {
        var menu = event.target.menu
        if (menu.style.display === "block") {
            menu.style.display = "none";
        } else {
            menu.style.display = "block";
        }
    }

    var bindings = {
        ".menu-button": {
            "init": function (binding, node) {
                node.menu = node.querySelector(".menu");
                node.tabIndex = 0;
            },
            "event-handlers": {
                "blur": toggleMenu,
                "focus": toggleMenu
            }
        },
        ".option": {
            "init": function (binding, node) {
                var optionName = node.textContent.toLowerCase();

                node.addEventListener("click", editorCommands[optionName] || function () {
                    alert("This option is not implemented yet!");
                });
            }
        }
    };
    bindNodes(bindings, document);

    console.log(localStorage.getItem("current-project"));

    editor = CodeMirror.fromTextArea(consoleInput, {
        lineNumbers: true,
        styleActiveLine: true,
        matchBrackets: true,
        extraKeys: { "Ctrl-B": setBreakpoint },
        theme: 'zenburn'
    });
    doc = editor.getDoc();

    readTextFile("./brainfuck.dual", function (text) {
        setTimeout(_ => {
            // var marks = doc.getAllMarks();
            // for (var i = 0; i < marks.length; ++i) {
            //     marks[i].clear();
            // }
            //doc.setValue(allText);
            doc.off('cursorActivity', onCursorActivity);
            doc.replaceRange(text, {line:0, ch:0}, {line:10000, ch:0});
            setTimeout(_ => {
                //doc.replaceRange("", doc.posFromIndex(allText.length), {line:10000, ch:0});
                parse_();
                doc.on('cursorActivity', onCursorActivity);
                editor.refresh();
                hideLoading_();
            }, 1000);
            // editor.refresh();
        }, 1000);
    });

    var start_stack = [];
    var arg_start_stack = [];
    var waiting = false;
    var expr;
    var from_index;
    var to_index;

    doc.on('cursorActivity', onCursorActivity);

    rootEnv.window = document.getElementById("page").contentWindow;

    doc.on('beforeChange', (doc, { text, from, to, removed, origin }) => {
        var { mark, offset } = getMarkObjAt(from),
            name, token;

        token = editor.getTokenAt(from); // get tokentypeat is way cheaper but returns just style
        // token.string can be from expression

        console.log('change');
        console.log(text, from, to, removed, origin, token.start);

        if (!origin) {
            return;
        }

        if (mark.expression.type === 'word') {
            name = token.string;
            name = name.slice(0, from.ch - token.start) + text + name.slice(to.ch - token.start);
            mark.expression.name = name;
        } else {
            name = token.string;
            name = name.slice(0, from.ch - token.start) + text + name.slice(to.ch - token.start);
            mark.expression.operator.name = name;
        }

        if (mark.expression.node)
            mark.expression.node.querySelector(".word").textContent = name;
    });

    listenEvent('parse:initialize', (event) => {
        expr = event.expression;
        from_index = event.from_index;
        to_index = event.to_index;
        console.log('event:', event);

        start_stack.push(event.character_index);

        showLoading_("parsing");
    });
    listenEvent('parse:done', (event) => {
        // wrap up markers
        mark_expression(event.expression, start_stack.pop(), event.character_index);
        currentlySelectedExpression = event.expression.node;
        console.log('parse:done');
        parsedProgram = event.expression;

        // doc.posFromIndex(event.character_index)
    });
    listenEvent('parse:apply-start', (event) => {
        //start_stack.push(event.character_index); // TODO: make parser provide the character_index
    });
    listenEvent('parse:apply-end', (event) => {
        // TODO: marker start and end will be different depending on whether parsing whole source or just a diff/fragment
        //mark_expression(event.expression, start_stack.pop(), event.character_index);

        /*marker.on('beforeCursorEnter', function () {
            if (!waiting) {
                console.log(marker.expression);
                waiting = true;
                setTimeout(_ => {
                    waiting = false;
                }, 1000);
            }
        });*/
    });
    listenEvent('parse:argument-start', (event) => {
        arg_start_stack.push(event.character_index);
    });
    listenEvent('parse:argument-end', (event) => {
        //console.log('parse:arg', event, arg_start_stack);
        mark_expression(event.expression, arg_start_stack.pop(), event.character_index);
    });
    // ... listen to parse:...
    // make parser supply the events with string positions?


    listenEvent('visualise:start', (event) => {
        showLoading_("visualising");
    });

    // TODO: make this sensible
    listenEvent('visualise:done', (event) => {
        var root;

        if (expr) {
            var row = event.result.querySelector('.argument-row');
            var id = expr.node.querySelector('.argument-id').textContent; // TODO: could pass from parse
            console.log('id:', id);

            console.log('expr:', expr);
            console.log('currentlySelectedExpression:', currentlySelectedExpression);
            console.log('row.expression:', row.expression);
            root = expr.node;
            var parent = expr.node.parentElement;
            while (parent.tagName !== 'TR') {
                parent = parent.parentElement;
            }
            parent.expression.args[id] = row.expression;
            console.log('parent.expression:', parent.expression);

            //currentlySelectedExpression.expression = row.expression; // this is bull; should be parent
            currentlySelectedExpression.parentElement.replaceChild(row, currentlySelectedExpression);
            currentlySelectedExpression = row;

            console.log(from_index, to_index);

            setTimeout(_ => {
                mark_expression(row.expression, from_index, to_index, 'red-back');
            }, 1000);
        } else {
            root = document.querySelector(".root-cell");
            root.replaceChild(event.result, root.firstChild);
        }
    });

    console.log(parse(consoleInput.value));

    // parse initial code
    // parse callbacks?
    // initialize markers accordingly

    initializePrimitiveList();
});