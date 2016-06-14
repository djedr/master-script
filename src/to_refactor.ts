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

// this used to do nice things when scrolling the visualisation
// it would keep the current context always on the screen
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

function getParameters(str) {
    var arr = str.split("&");
    var obj = {};
    var vals = arr.map((val) => { var v = val.split('='); obj[v[0]] = v[1]; return v;  });
    return obj;
}
var env = Object.create(process.env);



// TODO: space is not preserved on substitution
// have to add a prefix before the first arg -- how?
function substitute(expression, environment, branchId, mode) {
    // TODO: splice args from env into expression
    // match expression names with regex /{...}/
    // when such found, replace it with respective argument from the env
    // or simply could do if (env[name]) { replace this node with env[name] } else { don't touch }
    // or perhaps macro-evaluate the thing between {}
    // could work with !|name or { name }
    // if op.name === "!"
    // _|name
    var args, finalArgs, i, j, arg, prefix;

    switch (expression.type) {
        case 'word':
            return expression;//Object.assign({}, expression);
        case 'apply':
            // note: this is too early
            //expression = Object.assign({}, expression);

            if (expression.operator.name === "html'") {
                mode = "html";
            }

            if (expression.operator.type === "meta") {
                //var expr = evaluate(expression.args[0], environment, 0);
                prefix = expression.prefix.slice(0, -1);
                args = [];
                if (mode === "html") {
                    if (expression.args.length === 1 && expression.args[0].operator && expression.args[0].operator.type === "meta") {
                        expression = expression.args[0];
                    } else {
                        args = expression.args.map((arg, i) => {
                            return substitute(arg, environment, i, mode);
                        });
                        expression.args = args;

                        // NOTE: this is an ugly solution (copy-paste from below)
                        finalArgs = [];
                        for (i = 0; i < args.length; ++i) {
                            arg = args[i];

                            if (Array.isArray(arg)) {
                                for (j = 0; j < arg.length; ++j) {
                                    finalArgs.push(arg[j]);
                                }
                                //finalArgs = finalArgs.concat(arg);
                            } else {
                                finalArgs.push(arg);
                            }
                        }

                        expression.args = finalArgs;

                        return expression;
                    }
                    args.push(prefix);
                }


                for (j = 0; j < expression.args.length; ++j) {
                    args.push(evaluate(expression.args[j], environment, j));
                }
                // args = args.concat(expression.args.map((arg, i) => {
                //     return evaluate(arg, environment, i);
                // }));

                return args;
            }
            // expression.args = expression.args.map((arg, i) => {
            //     var args = substitute(arg, environment, i);
            // });

            //expression.operator = Object.assign({}, expression.operator);

            var operator = substitute(expression.operator, environment, branchId, mode);
            if (Array.isArray(operator)) { // {a b c op}[args] -> ([x y z f])[args] -> f[args]
                // perhaps {a b c op}[args] should turn into x y z f[args] instead of f[args]
                // otoh it's weird; for now it'll be an error
                if (operator.length !== 1) {
                    throw new TypeError("There can be only one operator for an expression! {}[args] or {a b c}[args] is not allowed. In the second case you may have meant {a b}{c}[args].");
                }
                // if (isModified === false) {
                //     expression = Object.assign({}, expression);
                //     isModified = true;
                // }
                expression.operator = operator[0];
            }

            args = [];

            for (i = 0; i < expression.args.length; ++i) {
                arg = substitute(expression.args[i], environment, i, mode);

                if (Array.isArray(arg)) {
                    // if (isModified === false) {
                    //     expression = Object.assign({}, expression);
                    //     isModified = true;
                    // }
                    for (j = 0; j < arg.length; ++j) {
                        args.push(arg[j]);
                    }
                    //args = args.concat(arg);
                } else {
                    args.push(arg);
                }
            }

            finalArgs = [];
            for (i = 0; i < args.length; ++i) {
                arg = args[i];

                if (Array.isArray(arg)) {
                    // if (isModified === false) {
                    //     expression = Object.assign({}, expression);
                    //     isModified = true;
                    // }
                    for (j = 0; j < arg.length; ++j) {
                        finalArgs.push(arg[j]);
                    }
                    //finalArgs = finalArgs.concat(arg);
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


// eliminate recursion and copying in substitute and evaluate
// stack based or treeConstructor-based


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
        value: function(...valArgs) {
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

            bindNames(args.slice(0, -1), valArgs, localEnv);

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
                if (expr.type === "[subst]") {
                    expr = quote(expr.value, localEnv);
                } else {
                    expr = quote(expr, localEnv);
                }
                return { type: "[subst]", value: expr };
                //expr = substitute(expr, localEnv, 0, ""); // note: should probably copy whole tree
            }
            return expr;
            // evaluate could do that: if return value is ast, splice it in place
            // substitute/evaluate expressions
            // splice into ast
        }
    };
};

specialForms["functions*"] = function(args, env) {
    if (!args.length)
        throw new SyntaxError("Functions need a body");

    var argsList = args[0].args.length > 0? evaluate(args[0], env, 0): undefined;
    var body = args[1];
    var alternative = undefined;

    // return object here { type: "[pattern function]", argsList: argsList, body: body, alternative: alternative }

    return function(...valArgs) {
        var localEnv = Object.create(env), ret;

        if (!argsList) { // empty param list matches anything
            return evaluate(body, localEnv, 1);
        }

        if (bindNames(argsList, valArgs, localEnv)) { // perhaps bindNames should return new environment
            return evaluate(body, localEnv, 1);
        } else if (args[2]) {
            alternative = evaluate(args[2], env, 2);
            if (typeof alternative === 'function') {
                ret = alternative.apply(null, valArgs);
                return ret;
            } else if (alternative.type === "[invocation]") { // if alt = undefined this will fail
                ret = alternative.method.apply(alternative.context, valArgs);
                return ret;
            } else { // alternative is a value?
                return alternative;
            }
            // fallthrough
        }

        throw new TypeError();
        return { type: "[error]", message: "unable to bind values to function arguments and no viable alternative provided" }; // maybe should throw here if alternative undefined?
        // or return errorInfo

        //return evaluate(body, localEnv, 1);
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

    return function(...valArgs) {
        if (valArgs.length != argNames.length)
            throw new TypeError("Wrong number of arguments");

        var localEnv = Object.create(env);
        // bindNames(args.slice(0, -1), arguments, localEnv);
        for (var i = 0; i < valArgs.length; i++)
            localEnv[argNames[i]] = valArgs[i];
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


specialForms["map-dict*"] = function (args, env) {
    var dict = evaluate(args[0], env, 0);
    var f = evaluate(args[1], env, 1);
    var newDict = Object.create({});

    for (var k in dict) {
        if (Object.prototype.hasOwnProperty.call(dict, k)) {
            newDict[k] = f(dict[k], k, dict);
        }
    }

    return newDict;
}

specialForms["map-dict-to-list*"] = function (args, env) {
    var dict = evaluate(args[0], env, 0);
    var f = evaluate(args[1], env, 1);
    var list = [];

    for (var k in dict) {
        if (Object.prototype.hasOwnProperty.call(dict, k)) {
            list.push(f(dict[k], k, dict));
        }
    }

    return list;
}


specialForms["inside*"] = function (args, env) {
    return evaluate(args[1], evaluate(args[0], env, 0), 1);
}

specialForms["id*"] = function (args, env) {
    return evaluate(args[0], env, 0);
}

specialForms["to-int"] = function (args, env) {
    return evaluate(args[0], env, 0) | 0;
}

specialForms["map-side"] = function (args, env) {
    var lst = evaluate(args[1], env, 1);
    var f = evaluate(args[0], env, 0);
    for (var i = 0; i < lst.length; ++i) {
        f(lst[i]);
    }
    return false;
}


specialForms[".,"] = function (args, env) {
    return evaluate(args[0], env, 0)[evaluate(args[1], env, 1)];
}

specialForms["log'"] = function (args, env) {
    var value = specialForms["$"](args, env);
    document.getElementById('console-output').innerHTML = value + '\n' + document.getElementById('console-output').innerHTML;

    console.log(document.getElementById('console-output').innerHTML);

    return value;
};

specialForms["set-timeout"] = function (args, env) {
    var time = evaluate(args[1], env, 1);
    setTimeout(_ => {
        evaluate(args[0], env, 0);
    }, time);
}

specialForms["add-listener"] = function (args, env) {
    var time = evaluate(args[1], env, 1);
    evaluate(args[0], env, 0).addEventListener(evaluate(args[1], env, 1), _ => {
        evaluate(args[2], env, 0);
    });
}

specialForms["async*"] = function (args, env) {
    var method = evaluate(args[0], env, 0), context = null, evaluatedArgs = [];

    if (method.type === "[invocation]") {
        method = method.method;
        context = method.context;
    }

    for (var i = 1; i < args.length; ++i) {
        evaluatedArgs.push(evaluate(args[i], env, i));
    }

    return method.apply(context, evaluatedArgs);
}

specialForms["block"] = function (args, env) {
    return args[0];
}

specialForms["comment"] = function (args, env) {
    return null;
}

specialForms["args-list"] = function (args, env) {
    return args;
}

specialForms["log"] = function (args, env) {
    var value = evaluate(args[0], env, 0);

    console.log(value);

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


specialForms["list"] = function (args, env) {
    var ret = [], len = args.length;
    for (var i = 0; i < len; ++i) {
        ret.push(evaluate(args[i], env, i));
    }
    return ret;
    // return args.map((arg, i) => {
    //     return evaluate(arg, env, i);
    // });
};

// note: this is a temporary implementation
specialForms["dict*"] = function (args, env) {
    var dict = {};

    for (var i = 0; i < args.length; i += 2) {
        dict[args[i].name] = evaluate(args[i+1], env, i+1);
    }

    return dict;
};


specialForms["alter*"] = function(args, env) {
    // todo: this should work like bind*, but only allow overwriting existing values (like mutate*)
    // probably will have to make a version of bindNames for that or alter the existing version adding a flag for mutation
};

specialForms["mutate*"] = function(args, env) {
    if (args.length != 2 || args[0].type != "word") {
        console.log("define.args != 2 or args[0].type != word");
        return null;
    }

    var value = evaluate(args[1], env, 1), scope = env;

    // if value.type && value.type === "[macro]"
    //    macros[args[0].name] = value.value
    // else:
    while (Object.prototype.hasOwnProperty.call(scope, args[0].name) === false) {
        scope = Object.getPrototypeOf(scope);
        if (!scope) {
            return error(`Can't mutate '${args[0].name}'! It is not defined!`);
        }
    }
    scope[args[0].name] = value;

    return env; // could also return env or scope; question is: which?
};


// note: this should validate
specialForms["assign*"] = function(args, env) {
    var vals = [];
    for (var i = 1; i < args.length; ++i) {
        vals.push(evaluate(args[i], env, i));
    }
    // var vals = args.slice(1).map((arg, i) => {
    //     return evaluate(arg, env, i + 1);
    // });
    return Object.assign(evaluate(args[0], env, 0), ...vals);
};

specialForms["scope*"] = function(args, env) {
    return Object.create({});
};

specialForms["invoke*"] = function(args, env) {
    // var evaluatedArgs = [];

    // var op = args[0];
    // var ar = args.slice[1];
    return evaluate({type: "apply", operator: args[0], args: args.slice(1), prefix: "[", postfix: "]", parent: args[0].parent}, env, 0);

    // var evaluatedOp = evaluate(args[0], env, 0);

    // if (evaluatedOp.type === "[macro]") {
    //     evaluatedOp.value.apply()
    // }

    // for (var i = 1; i < args.length; ++i) {
    //     evaluatedArgs.push(evaluate(args[i], env, i));
    // }

    // return .apply(null, evaluatedArgs);
};

specialForms["mutate-in*"] = function(args, env) {
    if (args.length != 3 || args[0].type != "word") {
        console.log("mutate-in.args != 3 or args[0].type != word");
        return error("mutate.args != 3 or args[0].type != word");
    }

    var value = evaluate(args[1], env, 1);
    env = evaluate(args[2], env, 2);

    // if value.type && value.type === "[macro]"
    //    macros[args[0].name] = value.value
    // else:
    if (env[args[0].name] === undefined) {
        throw new TypeError(`Can't mutate '${args[0].name}'! It is not defined!`);
    } else {
        while (Object.prototype.hasOwnProperty.call(env, args[0].name) === false) {
            env = Object.getPrototypeOf(env);
        }
        env[args[0].name] = value;
    }
    return env;
};


// note: could easily implement global unique define
// instead of Object.prototype.hasOwnProperty.call(env, args[0].name)
// do env[args[0].name] === undefined
specialFormsArgumentNames["define*"] = ["name", "value"];
specialForms["define*"] = function(args, env) {
  if (args.length != 2 || args[0].type != "word") {
    console.log("define.args != 2 or args[0].type != word");
    return { type: "[error]", message: "define.args != 2 or args[0].type != word" };
  }
  // todo: make it use bindNames

  var value = evaluate(args[1], env, 1);

  // if value.type && value.type === "[macro]"
  //    macros[args[0].name] = value.value
  // else:
  if (Object.prototype.hasOwnProperty.call(env, args[0].name) === false) {
      env[args[0].name] = value;
  } else {
      throw new TypeError(`Can't redefine '${args[0].name}'! It is already defined!`);
  }
  return value;
};

specialForms["push*"] = function(args, env) {
    if (args[1]) {
        var list = evaluate(args[1], env, 1);

        if (Array.isArray(list)) {
            // note: what if args[0] is undefined?
            list.push(evaluate(args[0], env, 0));
            return list;
        }
        return { type: "[error]", message: "can only push elements onto a valid list" };
    }
    return { type: "[error]", message: "need a list as the first argument" };
}

// todo: make mutate* work with objects
// make sure this (or bindNames) doesn't allow redefinition
// it should probably only complain if we're trying to redefine variable from the same scope
// i.e. if (Object.prototype.hasOwnProperty.call(env, name)) { complain }
// bindNames should take care of this
specialForms["bind*"] = function(args, env) {
    if (args[2]) {
        var scope = evaluate(args[2], env, 2);

        if (scope && typeof scope === "object") {
            env = scope;
        } else {
            return { type: "[error]", message: "can only bind inside a valid scope" };
        }
    }

    if (bindNames(evaluate(args[0], env, 0), evaluate(args[1], env, 1), env)) {
        return env;
    }

    return { type: "[error]", message: "can't bind values to names" };
};

specialForms["bind"] = function(args, env) {
    // todo: validate

    return function(value) {
        if (Object.prototype.hasOwnProperty.call(env, args[0].name) === false) {
            env[args[0].name] = value;
        } else {
            throw new TypeError(`Can't redefine '${args[0].name}'! It is already defined!`);
        }
        return value;
    }
};

specialForms["get*"] = function(args, env) {
    if (args[1]) {
        var scope = evaluate(args[1], env, 1);
        // scope not necessarily an object, could be a function
        if (scope.type === "[invocation]") {
            scope = scope.method;
        }
        var prop = evaluate(args[0], env, 0);
        return scope[prop];
    }

    return { type: "[error]", message: "need an object to get a property from" };
};

// a list should only support push and reading the indices, so no such thing as bind-index* should exist
specialForms["mutate-at-index*"] = function(args, env) {
    if (args[2]) {
        var list = evaluate(args[2], env, 2);

        if (Array.isArray(list)) {
            var index = evaluate(args[0], env, 0);
            if (Number.isInteger(index) && index >= 0 && list[index]) { // && index < list.length or && index <= list.length (= list.length would mean push)?
                list[index] = evaluate(args[1], env, 0);
                return list;
            } else {
                return { type: "error", message: "the index must be an integer >= 0 and an element under that index must be defined in the list" }
            }
        }
        return { type: "[error]", message: "can only mutate lists" };
    }
    return { type: "[error]", message: "mutate-at-index* needs a third argument of list type" }
};


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
    //   args.forEach(function(arg, i) {
    //     value = evaluate(arg, env, i);
    //   });

    for (var i = 0; i < args.length; ++i) {
        value = evaluate(args[i], env, i);
    }
    return value;
};

specialForms["sequence"] = specialForms["do"];


specialForms["module"] = function(args, env) {
    var value = false;
    args.forEach(function(arg, i) {
        value = evaluate(arg, env, i);
        if (value && value.type === "[subst]") {
            arg.parent.args[i] = value.value;
            value = evaluate(value.value, env, i);
        }
    });
    env["[value]"] = value;
    return env;
};


var specialForms = Object.create(null);
var specialFormsArgumentNames = Object.create(null);

"functions*": [
        0xdeadbeef,
        function (expr, env) {
            var args = expr.args;
            if (!args.length)
                throw new SyntaxError("Functions need a body");

            var argsList = args[0].args.length > 0? evaluate(args[0], env, 0): undefined;
            var body = args[1];
            var alternative = undefined;

            // return object here { type: "[pattern function]", argsList: argsList, body: body, alternative: alternative }

            return function(...valArgs) {
                var localEnv = Object.create(env), ret;

                if (!argsList) { // empty param list matches anything
                    return evaluate(body, localEnv, 1);
                }

                if (bindNames(argsList, valArgs, localEnv)) { // perhaps bindNames should return new environment
                    return evaluate(body, localEnv, 1);
                } else if (args[2]) {
                    alternative = evaluate(args[2], env, 2);
                    if (typeof alternative === 'function') {
                        ret = alternative.apply(null, valArgs);
                        return ret;
                    } else if (alternative.type === "[invocation]") { // if alt = undefined this will fail
                        ret = alternative.method.apply(alternative.context, valArgs);
                        return ret;
                    } else if (alternative.type === "[subst]") {
                        // how to get to the proper parent here?
                        //valArgs[0].parent.args[2] = alternative.value;
                        return evaluate(alternative.value, env, 2)(...valArgs);
                    } else { // alternative is a value?
                        return alternative;
                    }
                    // fallthrough
                }

                throw new TypeError();
                return { type: "[error]", message: "unable to bind values to function arguments and no viable alternative provided" }; // maybe should throw here if alternative undefined?
                // or return errorInfo

                //return evaluate(body, localEnv, 1);
            };
        }
    ],