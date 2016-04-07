var editor,
    primitiveList;

    function initializePrimitiveList() {
        var elm, primitive;
        primitiveList = document.querySelector('.primitive-list');
        
        for (primitive in specialForms) {
            elm = document.createElement('li');
            elm.innerHTML = primitive;
            
            // TODO: path instead of root row
            elm.addEventListener('click', (p => {
                return _ => {
                    var rootRow = document.querySelector('.root-call-table');
                    var parsed = parse(p + '[]');
                    rootRow.innerHTML = `<td class="input-connection-cell"></td>` + visualise_tree(parsed.tree, parsed.paths, {});
                    editor.setValue(unparse_tree(parsed.tree, parsed.paths, {}));
                }
            })(primitive));
            
            primitiveList.appendChild(elm);
        }
        
        primitiveList.addEventListener('click', _ => {
            primitiveList.style.display = "none";
        });
    }
    
    function displayPrimitiveList(event, expression) {
        var rect = event.target.getBoundingClientRect();
        primitiveList.style.display = "block";
        primitiveList.style.position = "absolute";
        primitiveList.style.zIndex = "10";
        primitiveList.style.top = (rect.top | 0) + "px";
        primitiveList.style.left = (rect.left | 0) + "px";
    }

    function ep (prog) {
        return evaluate(parse(prog), {});
    }

    function execute_and_visualise() {
        var to_parse = editor.getValue();
        var parsed = parse(to_parse);
        var evaluated = evaluate(parsed.expression, {});
        
        var rootRow = document.querySelector('.root-call-table');
        rootRow.innerHTML = `<td class="input-connection-cell"></td>` + visualise_tree(parsed.tree, parsed.paths, {});
        ep('log\'[' + evaluated + '\n<hr style=\'border: none; border-top: 1px solid #000;\' />' + ']');
        //console.log(JSON.stringify(parsed));
    }
    
    function drawLine(type, x, y, length) {
        var line = document.createElement("div"),
            borderSide = type === "vertical" ? "left" : "top",
            wh = type === "vertical" ? ["width", "height"] : ["height", "width"],
            styleCss = "border-" + borderSide + ": 1px solid blue; position: absolute; top: "
                        + y + "px; left: "
                        + x + "px; " + wh[0] + ": 0px; " + wh[1] + ": " + length + "px";
        
        line.style = styleCss;
        document.body.appendChild(line);
    }
    
    window.addEventListener("load", function () {
        editor = CodeMirror.fromTextArea(document.getElementById("console-input"), {
            lineNumbers: true,
            styleActiveLine: true,
            matchBrackets: true,
            theme: 'zenburn'
        });       
        
        initializePrimitiveList();
        
        var consoleInput = document.querySelector("#console-input");
        
        window.addEventListener("scroll", function () {
            var i, words = document.querySelectorAll('.word'), top;
            for (i = 0; i < words.length; ++i) {
                top = words.item(i).getBoundingClientRect().top;
                if (top < 0) {
                    words.item(i).querySelector('.name').style = "position: relative; top: " + (-top) + "px; color: rgba(255, 255, 255, 0.5)";
                } else {
                    words.item(i).querySelector('.name').style = "position: relative; top: 0";
                }
            }
        });
        
        CodeMirror.on(editor, 'keydown', function (event) {
        var i, words, names;
        
        console.log(event.which);
        switch (event.which) {
            case 9:
            event.preventDefault();
            consoleInput.value += "\t";
            break;   
            default:
            execute_and_visualise();
            words = document.querySelectorAll(".word");
            names = document.querySelectorAll(".name");
            
            //console.log(words);
            
            for (i = 0; i < words.length; ++i) {
                words.item(i).addEventListener("click", function (event) {
                event.target.style.backgroundColor = "#" + (Math.random()*4+5|0) + (Math.random()*4+5|0) + (Math.random()*4+5|0);
                });
                words.item(i).addEventListener("mouseover", function (event) {
                //var styleCss = "cursor: pointer;";

                //event.target.style = styleCss;
                });
            }
            
            break;
        }
        });
    });