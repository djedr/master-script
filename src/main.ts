var paths = [];
var tree = {};

var PATH_SEPARATOR = '/';
var PATH_END = '.';
var PATH_SELF = PATH_END;

function separate(expression_string) {
  var first = expression_string.search(/\S/);

  if (first === -1) {
    return {
      expression_string: "",
      separator: expression_string
    };
  }

  return {
    expression_string: expression_string.slice(first),
    separator: expression_string.slice(0, first)
  };
}

function parseApply(expression, expression_string, tree, paths, path) {
  var arg, separated, separator_cached, i, arg_path, end_path;

  separated = separate(expression_string);
  expression_string = separated.expression_string;

  if (expression_string[0] != "[") {
    expression.postfix += separated.separator;
    return { expression: expression, rest: expression_string };
  }
  separator_cached = separated.separator;

  path += PATH_SEPARATOR;

  separated = separate(expression_string.slice(1));
  expression_string = separated.expression_string;
  expression = {
    type: "apply",
    operator: expression,
    args: [],
    prefix: separator_cached + "[",
    postfix: ""
  };
  separator_cached = separated.separator;

  i = 0;
  while (expression_string[0] != "]") {
    arg_path = path + i;
    paths.push(arg_path);

    arg = parseExpression(expression_string, tree, paths, arg_path);

    tree[arg_path] = arg.expression;

    separated = separate(arg.rest);
    expression_string = separated.expression_string;
    arg.expression.prefix += separator_cached;

    separator_cached = separated.separator;

    expression.args.push(arg.expression);

    ++i;
  }
  expression.postfix += separator_cached + "]";

  end_path = path + PATH_END;
  paths.push(end_path);
  tree[end_path] = expression;

  return parseApply(expression, expression_string.slice(1), tree, paths, path);
}

function parseExpression(expression_string, tree, paths, path) {
  var match, expression, separated;

  separated = separate(expression_string);
  expression_string = separated.expression_string;

  if (match = /^[^\s\[\]]+/.exec(expression_string)) {
    expression = { type: "word", name: match[0], prefix: separated.separator, postfix: "" };
  } else {
    console.log('syntax error 2:');
    console.log(expression_string);
    return null;
  }

  return parseApply(expression, expression_string.slice(match[0].length), tree, paths, path);
}

function parse(expression_string) {
  var path = "0",
      paths = [],
      tree = {},
      result, separated;

  paths.push(path);
  result = parseExpression(expression_string, tree, paths, path);
  tree[path] = result.expression;
  separated = separate(result.rest);
  if (separated.expression_string.length > 0) {
      console.log('syntax error 3:');
      console.log(expression_string);
      return null;
  }
  result.expression.prefix += separated.separator;
  //console.log(tree, paths, visualise_tree(tree, paths, {}));
  return {
      expression: result.expression,
      tree: tree,
      paths: paths
  };
}

function unparse(expression, environment) {
  var op;

  switch (expression.type) {
    case "word":
      return expression.prefix + expression.name + expression.postfix;
    case "apply":
      op = expression.prefix.slice(1) + unparse(expression.operator, environment) + expression.prefix[0];

      expression.args.map(function (arg) {
        op += unparse(arg, environment);
      });
      return op + expression.postfix;
  }
}

function evaluate(expression, environment) {
  var op;

  switch (expression.type) {
    case "word":
      if (expression.name in environment) {
        return environment[expression.name];
      } else {
        console.log('reference error 1:');
        console.log(expression.name);
        return null;
      }
    case "apply":
      if (expression.operator.type === "word"
          && expression.operator.name in specialForms) {
        return specialForms[expression.operator.name](expression.args, environment);
      }

      op = evaluate(expression.operator, environment);
      if (typeof op !== 'function') {
        console.log('type error 1:');
        console.log('applying a non-function:');
        console.log(op);
        return;
      }
      return op.apply(null, expression.args.map(function (arg) {
        return evaluate(arg, environment);
      }));
  }
}

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

function visualise_word_node(node) {
    return `
        <span class="icon symbol-icon">${node.name[0]}</span>
        <span class="prefix">${node.prefix}</span>
        <span>${node.name}</span>
        <span class="postfix">${node.postfix}</span>
    `;
}

function visualise_argument_node(node) {

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
        <tr class="argument-row" data-path="${path}">
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

function connection() {
    return `
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
        </td>`;
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

function visualise_tree(tree, paths, environment) {
    var paths_length = paths.length,
        result = "",
        i, path, node, operator, arg_names = [], index;

    for (i = 0; i < paths_length; ++i) {
        path = paths[i];
        node = tree[path];
        index = path.slice(path.lastIndexOf('/') + 1);

        if (index === PATH_END) {
            result += `
                ${
                    argument_row({
                        path: path,
                        td_class: `argument-last-cell`,
                        argument_name: ``,
                        icon_class: `plus`,
                        icon: `+`,
                        gradient: true,
                        rest: ``
                    })
                }
                        </table>
                    </td>
                </tr>
            `;
            console.log(path);
        } else if (node.type === 'word') {
            result += argument_row({
                path: path,
                td_class: ``,
                argument_name: arg_names[index] || index,
                icon_class: `number`,
                icon: arg_names[index]? arg_names[index][0] : "#",
                gradient: false,
                rest: `
                ${connection()}
                ${call_cell({
                    data_symbol: node.name,
                    operator_cell_style: ``,
                    operator_div_style: ``,
                    div: visualise_word_node(node),
                    gradient: true
                })}
                `
            });
        } else if (node.type === 'apply') {
            operator = node.operator;

            result += argument_row({
                path: path,
                td_class: ``,
                argument_name: arg_names[index] || index,
                icon_class: `number`,
                icon: arg_names[index]? arg_names[index][0] : "#",
                gradient: false,
                rest: `
                ${connection()}
                ${call_cell({
                    data_symbol: operator.name,
                    operator_cell_style: `border-top-right-radius: 0`,
                    operator_div_style: `border-top-right-radius: 0`,
                    div: operator.type === 'word'?
                        visualise_word_node(operator):
                        `<div style="text-align: center">&#x2190;</div>`,
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

var specialForms = Object.create(null);
var specialFormsArgumentNames = Object.create(null);

specialFormsArgumentNames["if"] = ["condition", "if-condition-true", "if-condition-false"];
specialFormsArgumentNames["conditional"] = specialFormsArgumentNames["if"];

specialForms["if"] = function (args, env) {
  if (args.length !== 3) {
    console.log('sytax error 4:');
    console.log('if.args != 3');
    return;
  }

  if (evaluate(args[0], env) !== false) {
    return evaluate(args[1], env);
  } else {
    return evaluate(args[2], env);
  }
};
specialForms["conditional"] = specialForms["if"];

specialForms["#"] = function (args, env) {
  if (args.length !== 1) {
    console.log('sytax error 5:');
    console.log('#.args != 1');
    return;
  }

  return parseInt(args[0].name, 10);
};

specialForms["number"] = specialForms["#"];

specialForms["boolean"] = function (args, env) {
  if (args.length !== 1) {
    console.log('sytax error 6:');
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
  return args.reduce(function (previousValue, currentValue) {
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
      currentStr = evaluate(currentValue, env) + currentValue.postfix.slice(1)
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

  while (evaluate(args[0], env) !== false)
    evaluate(args[1], env);

  return false; // null
};

specialForms["do"] = function(args, env) {
  var value = false;
  args.forEach(function(arg) {
    value = evaluate(arg, env);
  });
  return value;
};

specialForms["sequence"] = specialForms["do"];

specialForms[":"] = function(args, env) {
  if (args.length != 2 || args[0].type != "word") {
    console.log("define.args != 2 or args[0].type != word");
    return null;
  }
  var value = evaluate(args[1], env);
  env[args[0].name] = value;
  return value;
};


specialFormsArgumentNames["define"] = ["name", "value"];
specialForms["define"] = specialForms[":"];

specialForms["print$"] = function(args, env) {
  var value = specialForms["$"](args, env);
  console.log(value)

  return value;
};

specialForms["eval"] = function(args, env) {
  return evaluate(args[0], env);
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