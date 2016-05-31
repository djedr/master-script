var paths = [];
var tree = {};

var PATH_SEPARATOR = '/';
var PATH_END = '.';
var PATH_SELF = PATH_END;

var argument_event_listener = (event) => {};
var run_argument_event_listener = (event) => {
    argument_event_listener(event);
    console.log("hi");
};

function separate(expression_string) {
    var first = expression_string.search(/\S/);

    if (first === -1) {
        return {
            expression_string: "",
            separator: expression_string
        };
    }

    var separator = expression_string.slice(0, first), tempSep = "", commentLevel = 0;
    expression_string = expression_string.slice(first);
    //first = estr.search(/--/);

    // handle comments
    if (expression_string[0] === '-' && expression_string[1] === '-') {
        if (expression_string[2] === '[') { // block comment -- note: doesn't allow any space between -- and [
            commentLevel = 1;
            separator += expression_string.slice(0, 3);
            expression_string = expression_string.slice(3);

            while (commentLevel > 0) {
                first = expression_string.search(/\]|\[/);
                separator += expression_string.slice(0, first);
                expression_string = expression_string.slice(first);
                if (first === -1) { // end of expression_string
                    throw new SyntaxError("Block comments must be closed!");
                } else if (expression_string[0] === ']') {
                    separator += expression_string[0];
                    expression_string = expression_string.slice(1);
                    --commentLevel;
                } else if (expression_string[0] === '[') {
                    separator += expression_string[0];
                    expression_string = expression_string.slice(1);
                    ++commentLevel;
                }
            }
            ({ expression_string, separator: tempSep } = separate(expression_string));
            separator += tempSep;
        } else { // line comment
            first = expression_string.search(/\n|$/);
            separator += expression_string.slice(0, first);
            expression_string = expression_string.slice(first);
            ({ expression_string, separator: tempSep } = separate(expression_string));
            separator += tempSep;
        }
    }

    // TODO: perhaps return number of chracters sliced and use that for character_index?
    return {
        expression_string: expression_string,// expression_string.slice(first),
        separator: separator//expression_string.slice(0, first)
    };
}

function parseApply(expression, expression_string, character_index, parent) {
    const openingCharacters = "[{|\\",
        closingCharacters = "]}"; // closingSequences = [/^\]/, /^\}/, /^[^\s\[\]\\{\}\|]/]

    var arg, separated, separator_cached, character_index_cached, word_end_index, argument_start_index,
        currentCharacter, openingCharacterIndex, closingCharacter;

    expression.parent = parent;

    word_end_index = character_index;

    separated = separate(expression_string);
    character_index += expression_string.length - separated.expression_string.length;
    expression_string = separated.expression_string;

    character_index_cached = character_index;
    argument_start_index = character_index + 1;

    // if (expression_string[0] === "|") { }

    currentCharacter = expression_string[0];

    openingCharacterIndex = openingCharacters.indexOf(currentCharacter);

    //   {
    //     "\\": /^[^\s\[\]\\{\}\|]/
    //     "[": "]",
    //     "{": "}",
    //   }

    if (openingCharacterIndex === -1 || (openingCharacterIndex === 1 && expression.type !== "meta")) { // not an apply
        //expression.postfix += separated.separator; // delete
        return {
            expression: expression,
            separator: separated.separator,
            rest: expression_string,
            character_index: word_end_index// TODO: make argument-end event return last argumentindex
        }; //  , prefix: separated.separator
    } else {
        closingCharacter = closingCharacters[openingCharacterIndex];

        separator_cached = separated.separator;

        separated = separate(expression_string.slice(1));
        character_index += expression_string.length - separated.expression_string.length;
        expression_string = separated.expression_string;
        expression = {
            type: "apply",
            operator: expression,
            args: [],
            prefix: separator_cached + currentCharacter,
            postfix: ""
        };
        separator_cached = separated.separator;

        emitEvent('parse:apply-start', { expression: expression, character_index: character_index_cached });

        if (openingCharacterIndex < 2) { // multiple args
            while (expression_string[0] !== closingCharacter) {
                emitEvent('parse:argument-start', { character_index: argument_start_index });

                arg = parseExpression(separator_cached, expression_string, character_index, expression);

                expression.args.push(arg.expression);

                emitEvent('parse:argument-end', { expression: arg.expression, character_index: arg.character_index });

                separated = separate(arg.rest);
                character_index += expression_string.length - separated.expression_string.length;
                expression_string = separated.expression_string;
                //arg.expression.prefix += separator_cached;
                //prefix = arg.prefix;

                argument_start_index = arg.character_index;

                separator_cached = separated.separator + arg.separator;
            }
            expression.postfix += separator_cached + closingCharacter;
            character_index += 1; // NOTE: consistent with .slice(1) below
            expression_string = expression_string.slice(1);
        } else if (openingCharacterIndex === 2) { // one arg
            // if (expression_string[0] === "|") // no args -- note: this allows |   |
            emitEvent('parse:argument-start', { character_index: argument_start_index });
            arg = parseExpression(separator_cached, expression_string, character_index, expression);
            expression.args.push(arg.expression);
            emitEvent('parse:argument-end', { expression: arg.expression, character_index: arg.character_index });

            expression_string = arg.rest;
            character_index = arg.character_index;
        } else { // no args

        }
    }

    emitEvent('parse:apply-end', { expression: expression, character_index: character_index });

    return parseApply(expression, expression_string, character_index, parent);
}

function parseExpression(prefix, expression_string, character_index, parent) {
    var match, expression, separated, original_expression_string;

    original_expression_string = expression_string;
    separated = separate(expression_string);
    character_index += expression_string.length - separated.expression_string.length;
    expression_string = separated.expression_string;

    // --[this is a comment;
    //    it works like a string, so can be nested;
    //    the only meaningful characters here are brackets [(] and [)].
    //    Perhaps | should have special meaning as well.
    //    Perhaps single-character escape, like in C. line1|nline2
    //    or |[expr] is equivalent to [expr] or [|expr]
    //    |op[args]; |[expr/value]; |value|
    //    A comment is inserted into following non-comment node's comments array
    //    Expressions [+[1 2]] inside it are parsed and transformed into ASTs?
    //    pipe | begins expression; pipe or ] ends expression
    //    [] must be balanced
    //    [| inserts [ and decreases balance counter
    //    |] inserts ] and leaves balance counter as-is
    // ]
    // '[Hello, [name]!] --[template string; or simple literal string if no expressions embedded]
    // '[Hello, |name|!] --[template string; or simple literal string if no expressions embedded]
    // `[[tag]Hello, [name]!] --[JavaScript-like template literal]
    // 12345.6789 --[number; anything that begins with a number (or minus? or plus? or dot?) is a number-word]
    // --[what about -22.8? the minus here]
    // or perhaps: #[number literal] // supports basic (or complex?) math on constants (or not just constants?)
    // how about: #|3 -- would this be valid?
    // also '|single-word-string or --|single-word-comment?
    // should be valid, but not allow spaces
    // subparsers for literals

    // -- aaa
    //
    //    -- bbb
    if (match = /^[^\s\[\]\\{\}\|]+/.exec(expression_string)) {
        expression = {
            type: "word",
            name: match[0],
            value: Number(match[0]),
            prefix: prefix + separated.separator,
            postfix: "" // note: likely can remove this
        };
        character_index += match[0].length; // TODO: cache this and reuse below?
        expression_string = expression_string.slice(match[0].length);
    } else if (match = /^{/.exec(expression_string)) {
        expression = { type: "meta" };
        expression_string = original_expression_string;
    } else {
        emitEvent('parse:error', {
            message: 'unrecognized characters [code 2]',
            source: expression_string
        });
        return null;
    }

    return parseApply(expression, expression_string, character_index, parent);
}

function parse(expression_string, options) {
  var result, separated,
      character_index,
      expression;

    options = options || { character_index: 0, expression: null };
    character_index = options.character_index;
    expression = options.expression; // perhaps redundant?

    // NOTE: this might be too simplistic
    // could check if there's more than one top-level expression first
    expression_string =
`sequence[
${expression_string}
]`;
    character_index -= 10;

    emitEvent('parse:initialize', options);

    result = parseExpression("", expression_string, character_index, null);

    separated = separate(result.rest);
    if (separated.expression_string.length > 0) {
        emitEvent('parse:error', {
            message: "extra characters [code 3]",
            source: expression_string
        });
        return null;
    }
    result.expression.postfix += separated.separator + result.separator;

    emitEvent('parse:done', {
        expression: result.expression,
        character_index: result.character_index//expression_string.length - 1
    });

    return {
        expression: result.expression
    };
}

createEvent('parse:initialize');
createEvent('parse:done');
createEvent('parse:error');
createEvent('parse:apply-start');
createEvent('parse:apply-end');
createEvent('parse:argument-start');
createEvent('parse:argument-end');

listenEvent('parse:error', (event) => {
    console.log('Syntax error:', event.message);
    console.log('Source:', event.source);
});

// tree constructor
function treeConstructor() {
    var path = "0",
        paths = [],
        path_stack = [],
        i_stack = [],
        tree = {},
        i = 0;

    listenEvent('parse:initialize', _ => {
        paths.push(path);
    });

    listenEvent('parse:done', (event) => {
        tree[path] = event.expression;
        console.log('tree constructor says:');
        console.log(tree);
    });

    listenEvent('parse:apply-start', _ => {
        i_stack.push(i);
        path_stack.push(path);

        path += PATH_SEPARATOR;
        i = 0;
    });

    listenEvent('parse:argument-start', (event) => {
        path_stack.push(path);

        path += i;
        paths.push(path);
    });

    listenEvent('parse:argument-end', (event) => {
        tree[path] = event.expression;
        ++i;

        path = path_stack.pop();
    });

    listenEvent('parse:apply-end', (event) => {
        var end_path = path + PATH_END;
        paths.push(end_path);
        tree[end_path] = event.expression;

        path = path_stack.pop();
        i = i_stack.pop();
    });
}

treeConstructor();


createEvent('visualise:done');

function visualiser() {
    var res, i, i_stack, node_stack;

    listenEvent('parse:initialize', (event) => {
        i = event.id || 0;
        i_stack = [];
        node_stack = [];

        res = document.createElement("table");
        res.className = "root-table";
        res.appendChild(document.createElement("tbody"));
        //console.log(event);
    });

    listenEvent('parse:done', (event) => {
        emitEvent('visualise:done', { result: res });
        console.log('visualise result:', res);
    });

    listenEvent('parse:apply-start', (event) => {
        node_stack.push(res);

        var node = document.createElement("tr");
        node.className = "argument-row";

        node.innerHTML =
            visualise_argument_node({ argument_id: i.toString() }) +
            connection() +
            visualise_apply_node({  });

        var operator_div = node.querySelector(".operator-div");
        var argument_div = node.querySelector(".argument-cell");
        argument_div.addEventListener('click', argument_event_listener);
        if (event.expression.operator.type === `word`) {
            operator_div.innerHTML = visualise_word_node(event.expression.operator);
        } else {
            operator_div.innerHTML = `<div style="text-align: center">&#x2190;</div>`;
        }

        // mutual binding
        node.expression = event.expression;
        event.expression.node = node;

        res.getElementsByTagName("tbody")[0].appendChild(node);
        res = node.querySelector(".call-table");

        i_stack.push(i);
        i = 0;
    });

    listenEvent('parse:argument-start', (event) => {
        node_stack.push(res);
    });

    listenEvent('parse:argument-end', (event) => {
        if (event.expression.type === `word`) {
            var node = document.createElement("tr");
            node.className = "argument-row";
            node.innerHTML =
                visualise_argument_node({ argument_name: i.toString() }) +
                connection() +
                visualise_apply_node({  });

            var operator_div = node.querySelector(".operator-div");
            var argument_div = node.querySelector(".argument-cell");
            operator_div.innerHTML = visualise_word_node(event.expression);

            argument_div.addEventListener('click', argument_event_listener);

            // mutual binding
            node.expression = event.expression;
            event.expression.node = node;

            res.getElementsByTagName("tbody")[0].appendChild(node);
        }

        ++i;
        res = node_stack.pop();
    });

    listenEvent('parse:apply-end', (event) => {
        i = i_stack.pop();
        res = node_stack.pop();
    });
}
visualiser();

function unparse(expression, branchId) {
    var op, prefix;

    switch (expression.type) {
    case "word":
        prefix = expression.prefix === "" && branchId > 0? " " : expression.prefix;
        return prefix + expression.name + expression.postfix;
    case "meta":
        return "";
    case "apply":
        op = unparse(expression.operator, branchId) + expression.prefix;

        expression.args.map(function (arg, i) {
            op += unparse(arg, i);
        });
        return op + expression.postfix;
    }
}

function unparseString(expression, env, branchId) {
    var op, prefix;

    switch (expression.type) {
        case "word":
            prefix = expression.prefix;
            return prefix + expression.name + expression.postfix;
        case "meta":
            return "";
        case "apply":
            if (expression.operator.type === "meta") {
                op = expression.prefix;
                // expression.args.map(function (arg, i) {
                //     op += evaluate(arg, env, i);
                // });
                return op + expression.postfix;
            }
            op = unparseString(expression.operator, env, branchId) + expression.prefix;

            expression.args.map(function (arg, i) {
                op += unparseString(arg, env, i);
            });
            return op + expression.postfix;
        default:
            return expression;
    }
}

// {expression, environment, parent, brachId, whitelist}
function evaluate(expression, environment, branchId) { // , root/currentRoot, branchId
    var op;

    //console.log(unparse(expression));

    switch (expression.type) {
    case "word":
        // this allows redefining a number:
        // bind should prevent user from defining numbers // bindNames
        if (expression.name in environment) {
            return environment[expression.name];
        } else if (isNaN(expression.value)) {
            console.log('reference error 1:');
            console.log(expression.name);
            return null;
        } else {
            return expression.value;
        }
    case "apply":
        // if whitelist { if op.name in whitelist -- return evaluate op w/o whitelist; else return node }

        // what about strings?
        // stringPrimitives -- handle substitution and evaluation on their own
        // primitives -- hande evaluation on their own
        // macros -- permanent substitution on ast-level

        // special forms handle substitution and evaluation on their own (lazily)
        // definitely fun, mac should
        // note: this will make {a}[b c d] -> if[b c d] not work
        if (expression.operator.name && expression.operator.name === "'") {
            //expression = substitute(expression, environment, branchId);
            return unparseString(expression, environment, branchId).slice(2, -1);
        }

        if (expression.operator.type === "word" && expression.operator.name in specialForms) {
            return specialForms[expression.operator.name](expression.args, environment);
        }

        op = evaluate(expression.operator, environment, branchId);
        if (typeof op !== 'function') {
            if (op && typeof op === 'object') { // non-null object
                if (op.type) { // TODO: implement this differently {tag} {type} {meta}
                    switch (op.type) {
                    case "[macro]":
                        var expr = op.value.apply(null, expression.args);

                        // permanent substitution:
                        if (expr.type !== '[macro]') {
                            expression.parent.args[branchId] = expr;//substitute(expr, environment, branchId);
                            expr.parent = expression.parent;
                            expr.operator.parent = expr.parent; // ?
                            //console.log(unparse(expr));
                            return evaluate(expr, environment, branchId);
                        }
                        return expr; // ?
                    case "word": // ???
                        // handle {op[sth]}
                        expression.operator = op; // replace op
                        // evaluate and replace args
                        expression.args = expression.args.map((arg, i) => {
                            return evaluate(arg, environment, i);
                        });
                        return expression;
                    }
                } else if (Array.isArray(op)) { // apply array -- get index
                    // TODO: implement number; this should work with literal numbers or values
                    var index = specialForms["number"](expression.args, environment),// evaluate(expression.args[0], environment, 0), // TODO: should return -0 or +0
                        length = op.length;
                        // TODO: expression.args[0] should be wrapped in num

                    if (Object.is(index, -0)) { // -0 means the last index
                        return op[length - 1];
                    } else if (index < 0) { // negative indices mean offset from the end
                        return op[length - index - 1];
                    } else { // assuming index is integer > 0
                        return op[index];
                    }
                } else { // makes op|x turn to op.x and op|x[y z x] turn to op.x(y, z, x)
                    op = op[expression.args[0].name]; // or evaluate expression.args[0]

                    if (typeof op !== 'function') {
                        return op;
                    }
                }
            }

            //
            // if macro, don't evaluate args; eval the macro, splice the returned ast in place and eval that
            // gotta keep track of macro's op -- root?
            // currentRoot.args[branchId] = returnedAst
            // else:
            console.log('type error 1:');
            console.log('applying a non-function:');
            console.log(op);
            return;
        }

        // not sure when this should happen
        expression = substitute(expression, environment, branchId); // this copies

        // scan args for meta first and evaluate that
        // for (i = 0; i < expression.args; ++i) {
        //     if (expression.args[i].type === "apply" && expression.args[i].operator.type === "meta") {
        //         evaluate(expression.args[i], environment, i);
        //     }
        // }
        // tests:
        // f[{{a} b c {d e}} f g {h {i j} k} l m n]

        // after there's no more meta arguments, evaluate as usual
        return op.apply(null, expression.args.map(function (arg, i) { // , i
            var ret = evaluate(arg, environment, i), expr;
            // identifying macros by return value:
            // if (Array.isArray(ret) && ret[1] is code) { // ret[1].type === "{code}"
            //     expression.args[i] = ret[1]; // no branch or parent nonsense
            //     return evaluate(ret[1], environment, i);
            // } else if (ret is code) {
            //     expression.args[i] = code; // no branch or parent nonsense
            //     return evaluate(code, environment, i);
            // }
            return ret; // , op, i
        }));
    }
}

// TODO?: var macros = Object.create({});

function visualise(expression, environment) {
  var op, result = '', arg_names = [];

  switch (expression.type) {
    case "word":
      result += `
        <span class="icon symbol-icon">${expression.name[0]}</span>
        <span>${expression.name}</span>
        <span class="postfix">${expression.postfix}</span>
      `;

      return result;
    case "apply":
      result += `
        <tr class="operator-row">
            <td class="operator-cell" style="border-top-right-radius: 0">
                <div class="operator-div" style="border-top-right-radius: 0">
                    ${expression.operator.type === `word` ?
                        visualise(expression.operator, environment)
                        : `<div style="text-align: center">&#x2190;</div>`
                    }
                </div>
            </td>
            ${expression.operator.type === `word` ?
                ``
                : `<td class="input-connection-cell" style="padding-top: 0">
                    <div class="input-connection-div">
                        <span class="input-connection-name">function</span>
                        <span class="icon define-icon" style="border-right: 1px solid;">f</span>

                        <span class="define-icon" style="top: 0; width: 0.33em; height: 28%; right: -0.33em; position: absolute; display: inline-block; z-index: 5; border-right: 1px solid; border-bottom: 1px solid; opacity: 0.66"></span>
                        <span class="define-icon" style="bottom: 0; width: 0.33em; height: 28%; right: -0.33em; position: absolute; display: inline-block; z-index: 5; border-right: 1px solid; border-top: 1px solid; opacity: 0.66"></span>
                    </div>
                </td>
                <td class="output-connection-cell" style="padding-top: 0">
                    <div class="output-connection-div">
                        <span class="define-icon" style="width: 0.33em; height: 30%; position: absolute; top: 29%; left: 0em; display: inline-block; z-index: 5; border: 1px solid; border-right: 0; opacity: 0.66"></span>

                        <span class="icon define-icon" style="margin-left: 0.33em; border-left: 1px solid;">f</span>
                        <span class="output-connection-name">function</span>
                    </div>
                </td>
                <td style="margin-left: -100%"><table><tr><div>${visualise(expression.operator, environment)}</div></tr></table></td>`
            }
        </tr>`;

      if (expression.operator.name in specialFormsArgumentNames) {
          arg_names = specialFormsArgumentNames[expression.operator.name];
      }

      expression.args.map(function (arg, i) {
        var title = `${expression.operator.name}@${i}:${arg_names[i] || `(value)`}`;

        result += `
            <tr class="argument-row">
                <td class="argument-cell">
                    <div class="argument-div">
                        <span>${arg_names[i] || i}</span>
                        <span class="icon number-icon">${arg_names[i]? arg_names[i][0] : "#"}</span>
                    </div>
                    <table class="argument-description-table">
                        <tr>
                            <td class="argument-description-cell">
                                ${title}
                            </td>
                        </tr>
                    </table>
                </td>
                <td class="input-connection-cell" onclick='displayPrimitiveList(event)'>
                    <div class="input-connection-div">
                        <span class="input-connection-name">any</span>
                        <span class="icon any-icon" style="border-right: 1px solid;">a</span>

                        <span class="any-icon" style="top: 0; width: 0.33em; height: 28%; right: -0.33em; position: absolute; display: inline-block; z-index: 5; border-right: 1px solid; border-bottom: 1px solid; opacity: 0.66"></span>
                        <span class="any-icon" style="bottom: 0; width: 0.33em; height: 28%; right: -0.33em; position: absolute; display: inline-block; z-index: 5; border-right: 1px solid; border-top: 1px solid; opacity: 0.66"></span>
                    </div>
                </td>
                <td class="output-connection-cell">
                    <div class="output-connection-div">
                        <span class="any-icon" style="width: 0.33em; height: 30%; position: absolute; top: 29%; left: 0em; display: inline-block; z-index: 5; border: 1px solid; border-right: 0; opacity: 0.66"></span>

                        <span class="icon any-icon" style="margin-left: 0.33em; border-left: 1px solid;">a</span>
                        <span class="output-connection-name">any</span>
                    </div>
                </td>
                <td class="call-cell">
                    <table class="call-table" data-symbol="${arg.name ? arg.name : arg.operator.name ? arg.operator.name : ''}">
                        ${arg.type === 'word' ? `
                        <tr class="operator-row">
                            <td class="operator-cell">
                                <div class="operator-div">
                                    ${visualise(arg, environment)}
                                </div>
                            </td>
                        </tr>
                        <tr class="argument-row">
                            <td class="argument-cell argument-last-cell">
                                <div class="gradient-div"></div>
                            </td>
                        </tr>`
                        : visualise(arg, environment)}
                    </table>
                </td>
            </tr>`;
      });

      return `
        ${result}
        <tr class="argument-row">
            <td class="argument-cell argument-last-cell">
                <div class="argument-div">
                    <span class="argument-name"></span>
                    <span class="icon plus-icon">+</span>
                </div>
                <div class="gradient-div"></div>
            </td>
        </tr>`;
  }
}

function unparse_tree(tree, paths, environment) {
    var paths_length = paths.length,
        result = "",
        i, path, node;

    for (i = 0; i < paths_length; ++i) {
        path = paths[i];
        node = tree[path];

        if (path[path.length - 1] === PATH_END) {
            result += node.postfix;
        } else if (node.type === 'word') {
            result += node.prefix + node.name + node.postfix;
        } else if (node.type === 'apply') {
            result += node.prefix.slice(1);
            if (node.operator.type === 'word') {
                result += node.operator.name;
            }
            result += node.prefix[0];
        }
    }

    return result + "";
}

// node_name_to_html_string
function visualise_word_node(node) {
    return `
        <span class="icon symbol-icon">${node.name[0]}</span>
        <span class="prefix">${node.prefix}</span>
        <span class="word">${node.name}</span>
        <span class="postfix">${node.postfix}</span>
    `;
}

function visualise_word_node_raw(node) {
    return `<!--
        --><pre class="prefix-raw" style="display: inline-block; background-color: rgba(255, 0, 0, 0.5)">${node.prefix}</pre><!--
        --><span>${node.name}</span><!--
        --><pre class="postfix-raw" style="display: inline-block; background-color: rgba(0, 255, 0, 0.5)">${node.postfix}</pre><!--
    -->`;
}

// argument slot
function visualise_argument_node({
        td_class: td_class = '',
        argument_name: argument_name = '',
        argument_id: argument_id = '',
        icon_class: icon_class = 'number',
        icon: icon = `#`,
        gradient: gradient = true
    }) {
    return `
            <td class="argument-cell ${td_class}">
                <div class="argument-div">
                    <span class="argument-id" ${argument_name !== ''? 'style="visibility: hidden"': ''}>${argument_id}</span>
                    <span class="argument-name">${argument_name}</span>
                    <span class="icon ${icon_class}-icon">${icon}</span>
                </div>
                ${gradient? `<div class="gradient-div"></div>` : ``}
            </td>
        `;
}

// word or operator slot
function visualise_apply_node({
    operator_cell_style: operator_cell_style = '',
    operator_div_style: operator_div_style = '',
    div: div = '',
    gradient: gradient = false,
    close: close = true}) {
    return `
        <td class="call-cell">
            <table class="call-table">
                <tbody>
                    <tr class="operator-row">
                        <td class="operator-cell" style="${operator_cell_style}">
                            <div class="operator-div" style="${operator_div_style}">
                                ${div}
                            </div>
                        </td>
                    </tr>
                    ${gradient? `
                    <tr class="argument-row">
                        <td class="argument-cell argument-last-cell">
                            <div class="gradient-div"></div>
                        </td>
                    </tr>`:
                    ``}
                </tbody>
            </table>
        </td>
    `;
}

function argument_row({
    path: path,
    td_class: td_class = '',
    argument_name: argument_name = '',
    icon_class: icon_class = 'number',
    icon: icon = `#`,
    gradient: gradient = true,
    rest: rest = '',
    close: close = true}) {
    return `
        <tr class="argument-row" data-path="${path}" onclick='displayPrimitiveList(event, "${path}")'>
            <td class="argument-cell${' ' + td_class}">
                <div class="argument-div">
                    <span class="argument-name">${argument_name}</span>
                    <span class="icon ${icon_class}-icon">${icon}</span>
                </div>
                ${gradient? `<div class="gradient-div"></div>` : ``}
            </td>
            ${rest}
        ${close? `
        </tr>`:
        ``}
    `;
}

function argument_row_raw({
    path: path,
    td_class: td_class = '',
    argument_name: argument_name = '',
    icon_class: icon_class = 'number',
    icon: icon = `#`,
    gradient: gradient = true,
    rest: rest = '',
    close: close = true}) {
    return `<!--
        --><span class="argument-row-raw" data-path="${path}" onclick="displayPrimitiveList(event, '${path}')"><!--
            -->${rest}<!--
        -->${close? `<!--
        --></span>`:
        ``}
    `;
}

function connection() {
    return `
        <td class="input-connection-cell">
            <div class="input-connection-div">
                <span class="input-connection-name">any</span>
                <span class="icon any-icon" style="border-right: 1px solid;">a</span>

                <span class="any-icon" style="top: 0; width: 0.33em; height: 28%; right: -0.33em; position: absolute; display: inline-block; z-index: 5; border-right: 1px solid; border-bottom: 1px solid; opacity: 0.66"></span>
                <span class="any-icon" style="bottom: 0; width: 0.33em; height: 28%; right: -0.33em; position: absolute; display: inline-block; z-index: 5; border-right: 1px solid; border-top: 1px solid; opacity: 0.66"></span>
            </div>
        </td>
        <td class="output-connection-cell">
            <div class="output-connection-div">
                <span class="any-icon" style="width: 0.33em; height: 30%; position: absolute; top: 29%; left: 0em; display: inline-block; z-index: 5; border: 1px solid; border-right: 0; opacity: 0.66"></span>

                <span class="icon any-icon" style="margin-left: 0.33em; border-left: 1px solid;">a</span>
                <span class="output-connection-name">any</span>
            </div>
        </td>`;
}

function connection_raw() {
    return ``;
}

function call_cell({
    data_symbol: data_symbol = '',
    operator_cell_style: operator_cell_style = '',
    operator_div_style: operator_div_style = '',
    div: div = '',
    gradient: gradient = false,
    close: close = true}) {
    return `
        <td class="call-cell">
            <table class="call-table" data-symbol="${data_symbol}">
                <tr class="operator-row">
                    <td class="operator-cell" style="${operator_cell_style}">
                        <div class="operator-div" style="${operator_div_style}">
                            ${div}
                        </div>
                    </td>
                </tr>
                ${gradient? `
                <tr class="argument-row">
                    <td class="argument-cell argument-last-cell">
                        <div class="gradient-div"></div>
                    </td>
                </tr>`:
                ``}
       ${close? `
            </table>
        </td>`:
        ``}
    `;
}

function call_cell_raw({
    data_symbol: data_symbol = '',
    operator_cell_style: operator_cell_style = '',
    operator_div_style: operator_div_style = '',
    div: div = '',
    gradient: gradient = false,
    close: close = true}) {
    return `<!--
        --><span class="call-cell-raw"><!--
            --><span class="call-table-raw" data-symbol="${data_symbol}"><!--
                -->${div}<!--
       -->${close? `<!--
            --></span><!--
        --></span>`:
        ``}<!--
    -->`;
}

function visualise_tree(tree, paths, environment) {
    var paths_length = paths.length,
        result = "",
        i, path, node, operator, arg_names = [], index;

    for (i = 0; i < paths_length; ++i) {
        path = paths[i];1
        node = tree[path];
        index = path.slice(path.lastIndexOf('/') + 1);

        if (index === PATH_END) {
            result += `<!--
                -->${
                    argument_row({
                        path: path,
                        td_class: `argument-last-cell`,
                        argument_name: ``,
                        icon_class: `plus`,
                        icon: `+`,
                        gradient: true,
                        rest: ``
                    })
                }<!--
                        --></table><!--
                    --></td><!--
                --></tr><!--
            -->`;
            console.log(path);
        } else if (node.type === 'word') {
            result += argument_row({
                path: path,
                td_class: ``,
                argument_name: arg_names[index] || index,
                icon_class: `number`,
                icon: arg_names[index]? arg_names[index][0] : "#",
                gradient: false,
                rest: `<!--
                -->${connection()}<!--
                -->${call_cell({
                    data_symbol: node.name,
                    operator_cell_style: ``,
                    operator_div_style: ``,
                    div: visualise_word_node(node),
                    gradient: true
                })}<!--
                -->`
            });
        } else if (node.type === 'apply') {
            operator = node.operator;

            // operator.prefix
            // operator.postfix
            console.log(node.prefix, node.postfix, operator);

            result += argument_row({
                path: path,
                td_class: ``,
                argument_name: arg_names[index] || index,
                icon_class: `number`,
                icon: arg_names[index]? arg_names[index][0] : "#",
                gradient: false,
                rest: `<!--
                -->${connection()}<!--
                -->${call_cell({
                    data_symbol: operator.name,
                    operator_cell_style: `border-top-right-radius: 0`,
                    operator_div_style: `border-top-right-radius: 0`,
                    div: (`<pre>${node.prefix}</pre>`) + (operator.type === 'word'?
                        visualise_word_node(operator):
                        `<div style="text-align: center">&#x2190;</div>`),
                    gradient: false,
                    close: false
                })}`,
                close: false
            });

            if (operator.name in specialFormsArgumentNames) {
                arg_names = specialFormsArgumentNames[operator.name];
            } else {
                arg_names = [];
            }
        }
    }

    return result;
}

function visualise_tree_autoclose(tree, environment) {
    var i, j, path, previous_path, diff, path_length, previous_path_length, paths_length, result, open_count, node, closing;

    i = 0;
    paths_length = paths.length;
    path = paths[i];
    previous_path_length = 0;
    result = "";
    open_count = 0;
    closing = [];

    for (; i < paths_length; ++i) {
        path = paths[i];
        node = tree[path];
        path_length = path.length;

        if (previous_path_length > path_length) {
            diff = previous_path.slice(path_length).split('/').length - 1;
            console.log(previous_path, path, diff);
            for (j = 0; j < diff; ++j) {
                result += closing.pop();
            }
        }

        // visualise node
        if (node.type === 'word') {
            result += node.prefix + node.name + node.postfix;
        } else if (node.type === 'apply') {
            result += node.prefix.slice(1);
            if (node.operator.type === 'word') {
                result += node.operator.name;
            }
            result += node.prefix[0];
            closing.push(node.postfix);
        }

        previous_path = path;
        previous_path_length = path_length;
    }

    for (j = 0; j < closing.length; ++j) {
        result += closing.pop();
    }

    return result + "";
}

function find_path_in_text(text, path) {
    var i, j = 0, path_steps = path.split('/'), current_arg = 0, open_count = 0;
    for (i = 0; i < text.length && open_count < path_steps.length; ++i) {
        if (text[i] === '[') {
            ++open_count;
            current_arg = parseInt(path_steps[open_count], 10);
            // TODO: skip_to_arg(current_arg)
        }
    }
    return i;
}

var specialForms = Object.create(null);
var specialFormsArgumentNames = Object.create(null);

specialFormsArgumentNames["if"] = ["condition", "if-condition-true", "if-condition-false"];
specialFormsArgumentNames["conditional"] = specialFormsArgumentNames["if"];

specialForms["if*"] = function (args, env) {
  if (args.length !== 3) {
    console.log('syntax error 4:');
    console.log('if.args != 3');
    return;
  }

  if (evaluate(args[0], env, 0) !== false) {
    return evaluate(args[1], env, 1);
  } else {
    return evaluate(args[2], env, 2);
  }
};
specialForms["conditional"] = specialForms["if*"];

specialForms["#"] = function (args, env) {
    if (args.length !== 1) {
        console.log('syntax error 5:');
        console.log('#.args != 1');
        return;
    }

    console.log(args, env);

    if (args[0].type === "word" && /^(\-|\+)?([0-9]+(\.[0-9]+)?|Infinity)$/.test(args[0].name)) {
        return Number(args[0].name);
    }

    return evaluate(args[0], env, 0);
};

specialForms["number"] = specialForms["#"];

specialForms["boolean"] = function (args, env) {
  if (args.length !== 1) {
    console.log('syntax error 6:');
    console.log('boolean.args != 1');
    return;
  }

  if (args[0].name === 'true') {
    return true;
  } else {
    return false;
  }
};

specialForms["$"] = function (args, env) {
  return args.reduce(function (previousValue, currentValue, index) {
    var currentStr;
    if (currentValue.type === "word") {
      currentStr = currentValue.prefix
        + currentValue.name
        + currentValue.postfix;
    } else if (currentValue.operator.type === "word"
               && currentValue.operator.name === "/") {
      if (currentValue.args.length === 0) {
        currentStr = "";
        previousValue = previousValue.slice(0, previousValue.length - 1);
      } else if (currentValue.args[0].type === "word") {
        switch (currentValue.args[0].name) {
          case "n":
            currentStr = "\n";
            break;
          case "(":
            currentStr = "[";
            break;
          case ")":
            currentStr = "]";
            break;
        }
      }
    } else {
      currentStr = evaluate(currentValue, env, index) + currentValue.postfix.slice(1)
    }

    return previousValue + currentStr;
  }, "");
};

specialFormsArgumentNames["string"] = ['value'];
specialForms["string"] = specialForms["$"];

specialForms["while"] = function(args, env) {
  if (args.length != 2) {
    console.log("syntax error:");
    console.log("while.args != 2");
    return;
  }

  while (evaluate(args[0], env, 0) !== false)
    evaluate(args[1], env, 1);

  return false; // null
};

specialForms["do"] = function(args, env) {
  var value = false;
  args.forEach(function(arg, i) {
    value = evaluate(arg, env, i);
  });
  return value;
};

specialForms["sequence"] = specialForms["do"];


specialFormsArgumentNames["define*"] = ["name", "value"];
specialForms["define*"] = function(args, env) {
  if (args.length != 2 || args[0].type != "word") {
    console.log("define.args != 2 or args[0].type != word");
    return null;
  }

  var value = evaluate(args[1], env, 1);

  // if value.type && value.type === "[macro]"
  //    macros[args[0].name] = value.value
  // else:
  if (env[args[0].name] === undefined) {
      env[args[0].name] = value;
  } else {
      throw new TypeError(`Can't redefine '${args[0].name}'! It is already defined!`);
  }
  return value;
};

specialForms["mutate*"] = function(args, env) {
  if (args.length != 2 || args[0].type != "word") {
    console.log("define.args != 2 or args[0].type != word");
    return null;
  }

  var value = evaluate(args[1], env, 1);

  // if value.type && value.type === "[macro]"
  //    macros[args[0].name] = value.value
  // else:
  if (env[args[0].name] === undefined) {
      throw new TypeError(`Can't mutate '${args[0].name}'! It is not defined!`);
  } else {
      env[args[0].name] = value;
  }
  return value;
};

specialForms["print$"] = function(args, env) {
  var value = specialForms["$"](args, env);
  console.log(value)

  return value;
};

specialForms["eval"] = function(args, env) {
  return evaluate(args[0], env, 0);
};

specialForms["$$"] = specialForms["eval"];
// $ = evaluate?
// ' = string?
// how about not parsing it at all? -- evaluator would have to be integrated with parser perhaps
// or just add exception to the parser -- if operator === "'" then skip to the next matching ']'
// then you'd need a parse special form as well
// do[:[a #[3]] print'['[hello, world]$[a]'[!]]]
// -> hello, world3!

specialForms["color-hex"] = function (args, env) {
    // todo: check args
    var hex_value = "#" + args[0].name;
    //document.getElementById("test-block").style.backgroundColor = hex_value;
    return hex_value;
};

specialForms["log'"] = function (args, env) {
    var value = specialForms["$"](args, env);
    document.getElementById('console-output').innerHTML = value + '\n' + document.getElementById('console-output').innerHTML;

    console.log(document.getElementById('console-output').innerHTML);

    return value;
};

specialForms["block"] = function (args, env) {
    return args[0];
}

specialForms["comment"] = function (args, env) {
    return null;
}

function restParameters(expr, env, parameters, j) {
    var rest = [];
    // NOTE: should validate that j is within parameters
    if (expr.args[0].name === "alt") {
        //debugger;
    }
    if (expr.args[0] && expr.args[0].name) {
        for (; j < parameters.length; ++j) {
            rest.push(parameters[j]);
        }
        env[expr.args[0].name] = rest; // note: expr.args[0].name must be defined
        return j;
    } else {
        throw new TypeError("Rest arguments must have a name as in '{name}'!");
        // or in that case discard rest
    }
}

function bindNames(args, values, env) {
    var i, j, expr, value, rest;
    for (i = 0, j = 0; i < args.length && j < values.length; ++i, ++j) {
        expr = args[i];
        switch (expr.type) {
        case "word": // bind
            if (expr.name !== "_") { // _ means placeholder -- binds to nothing
                env[expr.name] = values[j];
            }
            break;
        case "apply":
            if (expr.operator.type === "word") { // deconstruct
                value = values[j];

                switch (expr.operator.name) {
                case "list":
                    if (Array.isArray(value)) {
                        bindNames(expr.args, value, env);
                    } else {
                        return false;
                        //throw new TypeError(`Can't deconstruct value '${value}' with '${expr.operator.name}' operator!`);
                    }
                    break;
                case "code":
                    // todo
                    break;
                default:
                    // todo: allow bindName for the argument as in >[#\3 x] / >[x #\3]
                    if (["=", "<", "<=", ">=", "<>"].indexOf(expr.operator.name) !== -1) {
                        if (env[expr.operator.name](value, evaluate(expr.args[0], env, i)) === false) {
                            return false;
                        }
                    } else {
                        // unknown deconstruct operator
                        // this should probably be validated on function definition
                        //throw new TypeError(`Unknown deconstruct operator '${expr.operator.name}'!`);
                        return false;
                    }
                }
            } else if (expr.operator.type === "meta") { // construct/rest
                j = restParameters(expr, env, values, j);
            } else {
                //throw new TypeError("Deconstruct operator should be a word as in 'list[a b c]'");
                return false;
            }
            break;
        }
    }
    if (j < values.length) {
        //throw new TypeError("Too many arguments while calling the function!");
        //return fail("Too many arguments while calling the function!");
        return false;
    }
    if (i < args.length) {
        //throw new TypeError("Too few arguments while calling the function!");
        return false;
    }
    //return success();
    return true;
}

specialForms["args-list"] = function (args, env) {
    return args;
}

specialForms["functions*"] = function(args, env) {
    if (!args.length)
        throw new SyntaxError("Functions need a body");

    var argsList = evaluate(args[0], env, 0);
    var body = args[1];
    var altFun = args[2];

    return function() {
        var localEnv = Object.create(env);

        if (bindNames(argsList, arguments, localEnv)) { // perhaps bindNames should return new environment
            return evaluate(body, localEnv, 1);
        } else if (altFun) {
            var f = evaluate(altFun, env, 2);//.apply(null, arguments);
            if (typeof f !== 'function') {
                throw new TypeError("A non-function supplied as an alternative!");
            }
            return f.apply(null, arguments);
        } else {
            return undefined;
        }

        return evaluate(body, localEnv, 1);
    };
};

specialForms["function*"] = function(args, env) {
    if (!args.length)
        throw new SyntaxError("Functions need a body");

    function name(expr) {
        if (expr.type != "word")
            throw new SyntaxError("Arg names must be words");
        return expr.name;
    }
    var argNames = args.slice(0, args.length - 1).map(name);
    var body = args[args.length - 1];

    return function() {
        if (arguments.length != argNames.length)
            throw new TypeError("Wrong number of arguments");

        var localEnv = Object.create(env);
        // bindNames(args.slice(0, -1), arguments, localEnv);
        for (var i = 0; i < arguments.length; i++)
            localEnv[argNames[i]] = arguments[i];
        return evaluate(body, localEnv, args.length - 1);
    };
};
// tests:
// def[test-simple]\fun[a b]\+[a b]
// def[test-deconstruct]\fun[list[a b c] d]\+[a b c d]
// def[test-rest]\fun[a b {rest}]\+[a b rest\0 rest\1]
// def[test-complex]\fun[a list[b c d] {rest}]\+[a b c d rest\0 rest\1]

specialForms["code'"] = function(args, env) {
    return args[0];
    // TODO:
    // env should be macro's localEnv or relevant variables should be provided in args
    //var expr = copyExpression(args[0]); // to implement // makeSyntaxTree(args[0]) -- args[0] should be root, parents should be properly set
    // copying could be done by substitute/this function along with substitution
    //expr = substitute(expr, env, 0); // another way: if expression.type = word & name = _ then substitute args[++i] or sth
    // that is if parser converts this to a suitable format

    // what about _?[aux b]
    // in current model it could be _[aux b]
    // kind of lazy eval
};

specialForms["macro*"] = function(args, env) {
    if (!args.length)
        throw new SyntaxError("Functions need a body");

    // function name(expr) {
    //     if (expr.type != "word") {
    //         throw new SyntaxError("Arg names must be words or ...|word");
    //     }
    //     return expr.name;
    // }

    //var argNames = args.slice(0, args.length - 1).map(name);
    var body = args[args.length - 1];

    // var argCount = argNames.length; // arity
    // var lastArgId = argCount - 1;
    // var restName = "";

    // if (argNames[lastArgId][0] === '$') { // meaning array sigil
    //     restName = argNames[lastArgId] = argNames[lastArgId].slice(1);
    // }

    return {
        type: "[macro]",
        value: function() {
            // cases
            // al = anl -- perfect
            //  if last arg is [...] then ...
            //  else normal
            // al === anl - 1 -- maybe tolerable
            //  if last arg is [...] then its empty
            //  else error
            // al < anl - 1 -- error
            // al > anl -- maybe tolerable
            //  if last arg is [...] then it stores the remaining items
            //  else error

            var localEnv = Object.create(env);

            bindNames(args.slice(0, -1), arguments, localEnv);

            // for (var i = 0; i < lastArgId; i++) // NOTE: i is declared below as well
            //     localEnv[argNames[i]] = arguments[i];

            // if (restName && arguments.length >= lastArgId) { // can supply 0 arguments -- then rest will be empty
            //     localEnv[restName] = [];

            //     for (i = lastArgId; i < arguments.length; ++i)
            //         localEnv[restName].push(arguments[i]);
            // } else if (arguments.length === argNames.length) {
            //     localEnv[argNames[lastArgId]] = arguments[lastArgId];
            // } else {
            //     throw new TypeError("Wrong number of arguments");
            // }

            // expand macro permanently into ast
            // NOTE: this is mistaken:
            var expr = evaluate(body, localEnv, 0);//args.length - 1); // TODO: make that work with parentExpression
            if (expr.type !== '[macro]') {
                expr = substitute(expr, localEnv, 0); // note: should probably copy whole tree
            }
            return expr;
            // evaluate could do that: if return value is ast, splice it in place
            // substitute/evaluate expressions
            // splice into ast
        }
    };
};

function substitute(expression, environment, branchId) {
    // TODO: splice args from env into expression
    // match expression names with regex /{...}/
    // when such found, replace it with respective argument from the env
    // or simply could do if (env[name]) { replace this node with env[name] } else { don't touch }
    // or perhaps macro-evaluate the thing between {}
    // could work with !|name or { name }
    // if op.name === "!"
    // _|name
    var args, i, arg;

    switch (expression.type) {
        case 'word':
            return Object.assign({}, expression);
        case 'apply':
            expression = Object.assign({}, expression);

            if (expression.operator.type === "meta") {
                //var expr = evaluate(expression.args[0], environment, 0);
                args = expression.args.map((arg, i) => {
                    return evaluate(arg, environment, i);
                });

                return args;
            }
            // expression.args = expression.args.map((arg, i) => {
            //     var args = substitute(arg, environment, i);
            // });

            expression.operator = substitute(expression.operator, environment, branchId);
            if (Array.isArray(expression.operator)) { // {a b c op}[args] -> ([x y z f])[args] -> f[args]
                // perhaps {a b c op}[args] should turn into x y z f[args] instead of f[args]
                // otoh it's weird; for now it'll be an error
                if (expression.operator.length !== 1) {
                    throw new TypeError("There can be only one operator for an expression! {}[args] or {a b c}[args] is not allowed. In the second case you may have meant {a b}{c}[args].");
                }
                expression.operator = expression.operator[0];
            }

            args = [];

            for (i = 0; i < expression.args.length; ++i) {
                arg = substitute(expression.args[i], environment, i);

                if (Array.isArray(arg)) {
                    args = args.concat(arg);
                } else {
                    args.push(arg);
                }
            }

            var finalArgs = [];
            for (i = 0; i < args.length; ++i) {
                arg = args[i];

                if (Array.isArray(arg)) {
                    finalArgs = finalArgs.concat(arg);
                } else {
                    finalArgs.push(arg);
                }
            }

            expression.args = finalArgs;
            return expression;
    }

    // evaluate all _ nodes
    // they return code node, which should be spliced into the ast

    // macroEnvironment?
    //  instead if op.type === macro: if macroEnvironment[operator.name]
    //  macros = Object.create({})
    //  primitives = Object.create({})
    //  topEnvironment = ... // values = Object.create({})
    // pointers to parents in all nodes?
    // defmac puts macro into macros
}

// TODO: make parser recognize quoted code