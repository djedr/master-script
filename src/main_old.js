// util
// note: this should be moved to utils.js file

// source: http://stackoverflow.com/questions/10425287/convert-dash-separated-string-to-camelcase
function toCamelCase(input) {
    return input.toLowerCase().replace(/-(.)/g, function(match, group1) {
        return group1.toUpperCase();
    });
}
// end util

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

function restParameters(expr, env, parameters, j) {
    var rest = [];
    // NOTE: should validate that j is within parameters

    if (Object.prototype.hasOwnProperty.call(env, expr.args[0].name) !== false) {
        throw error(`${expr.args[0].name} already bound! Can't bind to rest...`)
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

// TODO: this should do evaluation
// if arg = _, shouldn't evaluate
// also this should probably take another argument and check if binding is destructive or constructive
function bindNames(args, values, env) {
    var i, j, expr, value, rest;

    // if (args.length === 0 && values.length === 0) // empty lists match
    //     return true;

    for (i = 0, j = 0; i < args.length && j < values.length; ++i, ++j) {
        expr = args[i];
        switch (expr.type) {
        case "word": // bind
            if (expr.value && Number.isNaN(expr.value) === false) {
                if (expr.value !== values[j])
                    return false;
            } else if (expr.name !== "_") { // _ means placeholder -- binds to nothing
                if (Object.prototype.hasOwnProperty.call(env, expr.name) === false) {
                    env[expr.name] = values[j];
                } else {
                    throw error(`${expr.name} already bound!`);
                }
            }
            break;
        case "apply":
            if (expr.operator.type === "word") { // deconstruct
                value = values[j];

                switch (expr.operator.name) {
                case "list": case "$":
                    if (Array.isArray(value)) {
                        if (bindNames(expr.args, value, env) === false) {
                            return false;
                        }
                    } else {
                        return false;
                        //throw new TypeError(`Can't deconstruct value '${value}' with '${expr.operator.name}' operator!`);
                    }
                    break;
                case "code":
                    // todo
                    throw new TypeError("code pattern matching is not implemented yet!");
                    break;
                case "'":
                    if (value !== evaluate(expr, env, 0)) {
                        return false;
                    }
                    break;
                // case "index":
                //     evaluate(expr.args[0], env, 0)[expr.args[1].name] = values[j];
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
    // empty list of rest parameters
    if (j === 0 && args[0].operator.type === "meta") {
        if (Object.prototype.hasOwnProperty.call(env, args[0].args[0].name) !== false) {
            throw error(`${args[0].args[0].name} already bound! Can't bind to rest...`)
        }
        env[args[0].args[0].name] = [];
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

function quote(expression, env, quoteOp = "") {
    var args = expression.args, arg;
    var newArgs = [];
    var isModified = false;
    var innerArgs;
    var innerOp;
    var meta;

    for (var j = 0; j < args.length; ++j) {
        arg = args[j];
        switch (arg.type) {
            case "word":
                newArgs.push(arg);
                break;
            case "apply":
                if (arg.operator.type === "meta") {
                    innerArgs = arg.args;
                    if (quoteOp === "html'") { // html' uses {{}} for substitution
                        if (innerArgs.length !== 1) {
                            newArgs.push(quote(arg, env, quoteOp));
                            break;
                        }

                        innerOp = innerArgs[0].operator;
                        if (!innerOp || innerOp.type !== "meta") {
                            newArgs.push(quote(arg, env, quoteOp));
                            break;
                        }
                    } else if (innerArgs.length === 1) { // by default {{}} substitutes for {}
                        // or should it be only inside code'?
                        isModified = true;
                        innerOp = innerArgs[0].operator;
                        if (innerOp && innerOp.type === "meta") {
                            newArgs.push(quote(innerArgs[0], env, quoteOp));
                            break;
                        }
                    }
                    meta = evaluate(arg, env, 0).value;
                    isModified = true;
                    for (var k = 0; k < meta.length; ++k) {
                        if (Array.isArray(meta[k])) {
                            for (var l = 0; l < meta[k].length; ++l) {
                                newArgs.push(meta[k][l]);
                            }
                        } else {
                            newArgs.push(meta[k]);
                        }
                    }
                } else {
                    var ret = quote(arg, env, quoteOp);
                    if (arg !== ret) {
                        isModified = true;
                    }
                    newArgs.push(ret);
                }
                break;
        }
    }

    if (isModified) {
        var newExpr = Object.assign({}, expression);
        // for (var i = 0; i < newArgs.length; ++i) {
        //     newArgs[i].parent = newExpr;
        // }
        newExpr.args = newArgs;
        return newExpr;
    } else {
        return expression;
    }
}

var rootEnv = {
    // meta
    "[imported paths]": {},

    // primitives
    "eval*": {
        type: "[primitive]",
        value: function (expr, env) {
            return evaluate(expr.args[0], env, 0);
        }
    },
    "module": {
        type: "[primitive]",
        value: function (expr, env) {
            var value = false;
            var args = expr.args;
            args.forEach(function (arg, i) {
                value = evaluate(arg, env, i);
                if (value && value.type === "[subst]") {
                    expr.args[i] = value.value;
                    value = evaluate(value.value, env, i);
                }
            });
            env["[value]"] = value;
            return env;
        }
    },
    "import": {
        type: "[primitive]",
        value: function(expr, env) {
            var args = expr.args;
            var path = evaluate(args[0], env, 0);

            var importedPaths = env["[imported paths]"];

            if (importedPaths[path]) {
                return importedPaths[path];
            }

            localStorage.setItem('pathToRead', path);
            // var reader = new FileReader();
            // reader.onloadend = function(event) {
            //     var result = event.target.result;
            //     console.log(result);
            // };
            // reader.readAsDataURL(path);
            var contents;
            while ((contents = localStorage.getItem(path)) === null) {

            }

            var code = "";
            // rootEnv is basic functions, etc. same as in editor.ts
            //var modEnv = evaluate(parse(code), rootEnv, 0); // shouldn't visualise -- maybe a flag option to parse?
            var modEnv = {}; // shouldn't visualise -- maybe a flag option to parse?
            importedPaths[path] = modEnv;

            return modEnv;
        }
    },
    "if": {
        type: "[primitive]",
        value: function (expr, env) {
            if (expr.args.length !== 3) {
                console.log('syntax error 4:');
                console.log('if.args != 3');
                throw { type: "[error]", message: "if expression needs 3 arguments: condition, then and else", data: [expr] };
            }

            if (evaluate(expr.args[0], env, 0) !== false) {
                return evaluate(expr.args[1], env, 1);
            } else {
                return evaluate(expr.args[2], env, 2);
            }
        }
    },
    "while": {
        type: "[primitive]",
        value: function (expr, env) {
            if (expr.args.length != 2) {
                console.log("syntax error:");
                console.log("while.args != 2");
                throw { type: "[error]", message: "while expression needs 2 arguments: condition and body", data: [expr] };
            }

            while (evaluate(expr.args[0], env, 0) !== false)
                evaluate(expr.args[1], env, 1);

            return false; // null
        }
    },
    "do": {
        type: "[primitive]",
        value: function (expr, env) {
            var value = false;

            for (var i = 0; i < expr.args.length; ++i) {
                value = evaluate(expr.args[i], env, i);
                if (value) {
                    switch (value.type) {
                    case "[subst]":
                        expr.args[i] = value.value;
                        value = evaluate(value.value, env, i);
                        break;
                    case "[return]":
                        return value.value;
                    }
                }
            }

            return value;
        }
    },
    "return": {
        type: "[primitive]",
        value: function (expr, env) {
            return { type: "[return]", value: evaluate(expr.args[0], env, 0) };
        }
    },
    "mutate*": {
        type: "[primitive]",
        value: function(expr, env) {
            var args = expr.args;
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
        }
    },
    // note: this should validate
    "assign": {
        type: "[primitive]",
        value: function (expr, env) {
            var args = expr.args;
            var vals = [];
            for (var i = 1; i < args.length; ++i) {
                vals.push(evaluate(args[i], env, i));
            }
            // var vals = args.slice(1).map((arg, i) => {
            //     return evaluate(arg, env, i + 1);
            // });
            return Object.assign(evaluate(args[0], env, 0), ...vals);
        }
    },
    "code'": {
        type: "[primitive]",
        value: function (expr, env) {
            return expr.args[0];
        }
    },
    "macro*": {
        type: "[primitive]",
        value: function (expression, env) {
            var args = expression.args;

            if (!args.length)
                throw new SyntaxError("Functions need a body");

            var body = args[args.length - 1];

            return {
                type: "[macro]",
                value: function(expression) { //...valArgs) {

                    var str = '';

                    // for (var i = 0; i < valArgs.length; ++i) {
                    //     if (valArgs[i].type === "apply") {
                    //         str += valArgs[i].operator.name + ' ';
                    //     } else {
                    //         str += valArgs[i].name + ' ';
                    //     }
                    // }

                    console.count(`macro ${str}`);

                    var valArgs = expression.args;

                    var localEnv = Object.create(env);

                    bindNames(args.slice(0, -1), valArgs, localEnv);

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
                }
            };
        }
    },
    "args-list": {
        type: "[primitive]",
        value: function (expr, env) {
            return expr.args;
        }
    },
    "bind": {
        type: "[primitive]",
        value: function (expr, env) {
            var args = expr.args;
            if (args.length !== 2) {
                var message = `let needs two arguments: a pattern and a value to match! ${unparse(expr)}`;
                console.log(message);
                throw { type: "[error]", message: message, data: [expr, env]};
            }

            var pattern = [args[0]];
            var value = [evaluate(args[1], env, 1)];
            // note: turning off macros:
            // if (value && value.type === "[subst]") {
            //     expr.args[1] = value.value;
            //     value = evaluate(value.value, env, 1);
            // }

            if (bindNames(pattern, value, env))
                return value;

            throw error(`can't bind pattern to value!`);
        }
    },
    "of": {
        type: "[primitive]",
        value: function (expr, env) {
            var args = expr.args;
            if (args.length !== 2) {
                var message = `function must have an argument or (possibly empty) list of arguments and a body! ${unparse(expr)}`;
                console.log(message);
                throw { type: "[error]", message: message, data: [expr, env]};
            }

            var funArgs = args[0].type === "word"? [args[0]]: args[0].args;
            var funBody = args[1];

            // return object here { type: "[pattern function]", argsList: argsList, body: body, alternative: alternative }

            return function(...valArgs) {
                var localEnv = Object.create(env);

                if (bindNames(funArgs, valArgs, localEnv)) { // perhaps bindNames should return new environment
                    return evaluate(funBody, localEnv, 1);
                }

                throw { type: "[error]",
                    message: "unable to bind values to function arguments"
                };
            };
        }
    },
    // maybe should be subject to black metacircular magic later
    "procedure": {
        type: "[primitive]",
        value: function (expr, env) {
            var args = expr.args;
            if (args.length !== 1)
                throw { type: "[error]", message: `procedure must have a body! ${unparse(expr)}`, data: [expr, env]};

            var procBody = args[0];

            return function(...valArgs) {
                return evaluate(procBody, env, 1);
            };
        }
    },
    "match": {
        type: "[primitive]",
        value: function (expr, env) {
            var args = expr.args;
            var valArgs = [evaluate(args[0], env, 0)];
            var arg;
            var localEnv = Object.create(env);

            for (var i = 1; i < args.length; ++i) {
                arg = args[i];
                if (bindNames([arg.args[0]], valArgs, localEnv)) {
                    return evaluate(arg.args[1], localEnv, 1);
                }
            }
            throw error("no match");
        }
    },
    "of-match": {
        type: "[primitive]",
        value: function (expr, env) {
            var args = expr.args;
            if (args.length !== 2)
                throw { type: "[error]", message: `function must have an argument or (possibly empty) list of arguments and a body! ${unparse(expr)}`, data: [expr, env]};

            // return object here { type: "[pattern function]", argsList: argsList, body: body, alternative: alternative }

            return function(...valArgs) {
                var localEnv = Object.create(env);

                var arg;

                for (var i = 1; i < args.length; ++i) {
                    arg = args[i];
                    if (bindNames([arg.args[0]], valArgs, localEnv)) {
                        return evaluate(arg.args[1], localEnv, 1);
                    }
                }

                throw { type: "[error]",
                    message: "unable to bind values to function arguments"
                };
            };
        }
    },
    "cond": {
        type: "[primitive]",
        value: function (expr, env) {
            var args = expr.args;
            var arg;

            for (var i = 0; i < args.length; ++i) {
                arg = args[i];
                if (evaluate(arg.args[0], env, 0) !== false) {
                    return evaluate(arg.args[1], env, 1);
                }
            }
            throw error("no cond");
        }
    },
    "functions*": {
        type: "[primitive]",
        value: function (expr, env) {
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
    },
    "invoke*": {
        type: "[primitive]",
        value: function(expr, env) {


            //var value = evaluate({
            var value = {
                type: "apply",
                operator: expr.args[0],
                args: expr.args.slice(1),
                prefix: "[",
                postfix: "]",
                parent: expr
            };
            //}, env, 0);

            //var expr = quote(value, env);

            return {type: "[subst]", value: value};

            // if (value && value.type === "[subst]") {
            //     return evaluate(value.value, env, 0);
            // } else {
            //     return value;
            // }
        }
    },
    // this can definitely be way more efficient
    ".": {
        type: "[primitive]",
        value: function (expr, env) {
            // 0th arg -- object/array
            // 1st..nth arg -- prop names, not evaluated if words
            var args = expr.args;

            // first context is env
            if (args.length < 1) {
                throw TypeError();
                return { type: "[error]", message: "access operator . needs at least 1 argument: the accessed property name within current context (as identifier or string)" };
            }

            var context = env, property;

            if (args.length === 1)
                return getPropertyAt(context, args, env, 0);

            context = evaluate(args[0], env, 0);

            if (!context) { // note: should verify context here to make sure that it has accessable properties
                throw TypeError();
                return error("given context has no accessable properties", [args, env]);
            }

            property = getPropertyAt(context, args, env, 1);

            for (var i = 2; i < args.length; ++i) {
                context = property;
                property = getPropertyAt(context, args, env, i);
            }

            // if the final value is function, make sure it will be applied in a proper context when invoked
            // note: the context will not be (easily) separable later this way
            if (typeof property === "function") {
                return { type: "[invocation]", context: context, method: property };
            }

            return property;
        }
    },
    // this can definitely be way more efficient
    // this mutates or binds if not defined
    ":": {
        type: "[primitive]",
        value: function (expr, env) {
            var args = expr.args;
            // 0th arg -- object/array
            // 1st..nth arg -- prop names, not evaluated if words
            if (args.length < 2) {
                return { type: "[error]", message: "update operator : needs at least 2 arguments: the property name to set within current context (as identifier or string) and the value to set" };
            }

            var context = env, property, propertyName,
                value = evaluate(args[args.length - 1], env, args.length - 1);

            if (args.length === 2)
                return setPropertyAt(context, args, env, 0, value);

            // args > 2
            context = rootEnv["."].value({ args: args.slice(0, -2) }, env);

            if (!context) { // note: should verify context here to make sure that it has accessable properties
                return error("given context has no accessable properties");
            }

            // get array at index
            if (Array.isArray(context) && Number.isInteger(args[1].value)) {
                var length = context.length, index = args[1].value;

                if (index < 0) { // negative indices mean offset from the end
                    // could do modulo instead error, but that might cause hard to find bugs
                    if (-index > length) {
                        return { type: "[error]", message: `negative indices are allowed and count from the end, but index ${index} is still out of bounds;` };
                    }
                    return context[length - index] = value;
                    //return context[length - index];
                } else { // assuming index is integer > 0
                    if (index >= length) {
                        return { type: "[error]", message: `index ${index} is out of bounds` }
                    }
                    return context[index] = value;
                    //return context[index];
                }
            }

            return setPropertyAt(context, args, env, args.length - 2, value);
        }
    },
    "@": { // identity
        type: "[primitive]",
        value: function (expr, env) {
            return evaluate(expr.args[0], env, 0);
        }
    },
    // note: this is a temporary implementation
    "dict*": {
        type: "[primitive]",
        value: function (expr, env) {
            var dict = {};
            var args = expr.args;

            for (var i = 0; i < args.length; i += 2) {
                dict[args[i].name] = evaluate(args[i+1], env, i+1);
            }

            return dict;
        }
    },
    "map-dict*": {
        type: "[primitive]",
        value: function (expr, env) {
            var args = expr.args;
            var dict = evaluate(args[0], env, 0);
            var f = evaluate(args[1], env, 1);
            var newDict = Object.create(null);

            for (var k in dict) {
                if (Object.prototype.hasOwnProperty.call(dict, k)) {
                    newDict[k] = f(dict[k], k, dict);
                }
            }

            return newDict;
        }
    },
    "async*": {
        type: "[primitive]",
        value: function (expr, env) {
            var args = expr.args;
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
    },
    //
    // regular
    //
    "true": true,
    "false": false,
    "undefined": undefined,
    "is-defined": (a) => { return a !== undefined; },
    "is-function": (a) => { return typeof a === "function"; },
    "or": (a, b) => { return a || b; },
    "any": (...args) => {
        for (var i = 0; i < args.length; ++i) {
            if (args[i] === true) {
                return true;
            }
        }
        return false;
    },
    "and": (a, b) => { return a && b; },
    "not": (a) => { return !a; },
    "=": (a, b) => { return a === b; }, // Object.is?
    "<>": (a, b) => { return a !== b; }, // !Object.is?
    "+": (a, b) => { return a + b; },
    "-": (a, b) => { return a - b; },
    "-#": (a) => { return -a; }, // unary minus
    "*": (a, b) => { return a * b; },
    "/": (a, b) => { return a / b; },
    "mod": (a, b) => { return a % b; },
    "<": (a, b) => { return a < b; },
    ">": (a, b) => { return a > b; },
    "<=": (a, b) => { return a <= b; },
    ">=": (a, b) => { return a >= b; },
    "log": (...args) => { console.log(...args); return args[args.length - 1]; },
    //"set-page": (str) => { document.getElementById("page").srcdoc = str; },
    "page": () => { return document.getElementById("page").contentWindow.document.getElementById("canvas-A"); },
    "window": window,
    "apply": (f, args) => { return f.apply(null, args); },
    "list": (...args) => { return args; },
    "$": (...args) => { return args; },
    "to-int": (a) => { return a | 0; },
    "map-dict-to-list*": (dict, f) => {
        var list = [];

        for (var k in dict) {
            if (Object.prototype.hasOwnProperty.call(dict, k)) {
                list.push(f(dict[k], k, dict));
            }
        }

        return list;
    },
    "delete*": (obj, prop) => { delete obj[prop]; },
    "debug*": () => { debugger; return null; }
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
    const openingCharacters = "[{|!",
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

        // note: this shouldn't be performed if the opening character is \ (zero-arg)
        // because now we have to backtrack unnecessarily
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
            // TODO: sort out these spaces
            // for ` [   ]` expr prefix is ` [` and postfix is `   ]`
            // for `  \   ` it should be: prefix = `  \` and postfix = ``;
            // in other words it shouldn't skipSpace after the \
            //expression.postfix += separator_cached;
            character_index -= separator_cached.length;
            expression_string = separator_cached + expression_string;
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
    if (match = /^[^\s\[\]!{\}\|]+/.exec(expression_string)) {
        var value = Number(match[0]);
        expression = {
            type: "word",
            name: match[0],
            value: Number.isNaN(value)? undefined: value,
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
        throw {
            type: "error",
            message: 'unrecognized characters (source: 0)',
            data: [expression_string]
        }
    }

    return parseApply(expression, expression_string, character_index, parent);
}

function parse(expression_string, options) {
  var result, separated,
      character_index,
      expression,
      rootOperator;

    options = options || { character_index: 0, expression: null };
    character_index = options.character_index;
    expression = options.expression; // perhaps redundant?

    // NOTE: this might be too simplistic
    // could check if there's more than one top-level expression first
    rootOperator = "module[";
    expression_string = rootOperator + expression_string + ']';

    character_index -= rootOperator.length;

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

// NOTE: this enables tree constructor:
//treeConstructor();


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
// NOTE: this enables the visualiser
//visualiser();

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

        for (var i = 0; i < expression.args.length; ++i) {
            op += unparse(expression.args[i], i);
        }
        // expression.args.map(function (arg, i) {
        //     op += unparse(arg, i);
        // });
        return op + expression.postfix;
    }
}

function unparseString(expression, env, branchId) {
    var op, prefix;

    switch (expression.type) {
        case "word":
            return expression.prefix + expression.name + expression.postfix;
        case "meta":
            return "";
        case "apply":
            // if (expression.operator.type === "meta") {
            //     op = expression.prefix;
            //     // expression.args.map(function (arg, i) {
            //     //     op += evaluate(arg, env, i);
            //     // });
            //     return op + expression.postfix;
            // }
            op = unparseString(expression.operator, env, branchId) + expression.prefix;

            var len = expression.args.length;
            for (var i = 0; i < len; ++i) {
                op += unparseString(expression.args[i], env, i);
            }
            // expression.args.map(function (arg, i) {
            //     op += unparseString(arg, env, i);
            // });
            return op + expression.postfix;
        default:
            return expression;
    }
}

function metaFunction(...args) {
    return {type: "[meta-apply]", value: args};
}

function expand(expression, environment) {
    var result, evaluatedOp;

    while (true) {
        expression = expression.operator;
        evaluatedOp = evaluate(expression, environment);

        if (evaluatedOp && evaluatedOp.type === "[macro]") {
            result = evaluatedOp.value(expression); // currently op.value(...expression.args)
        } else {
            break;
        }
    } while (result && result.type === "[macro]");
    return result;
}

// {expression, environment, parent, brachId, whitelist}
function evaluate(expression, environment, branchId) { // , root/currentRoot, branchId
    var op, context;

    //console.log(unparse(expression));

    // if (expression.breakpoint) {
    //     debugger;
    // }

    switch (expression.type) {
    case "word":
        // this allows redefining a number:
        // bind should prevent user from defining numbers // bindNames
        if (expression.name in environment) {
            return environment[expression.name];
        } else if (expression.value !== undefined) {
            return expression.value;
        }
        console.log('reference error 1:');
        console.log(expression.name);
        throw new TypeError(`reference error: ${expression.name}`);
        return { type: "[error]", message: `reference error: ${expression.name}` };
        // Number.isNaN(expression.value)) {
        //     console.log('reference error 1:');
        //     console.log(expression.name);
        //     throw new TypeError(`reference error: ${expression.name}`);
        //     return { type: "[error]", message: `reference error: ${expression.name}` };
        // } else {
        //     return expression.value;
        // }
        break;

    case "meta":
        return metaFunction; // const metaObject = { type: "[meta]" }; return metaObject;
        break;
    case "apply":
        // expand needs to evaluate op, so this doesn't have to be done later
        // var expandedArg;
        // for (var i = 0; i < expression.args.length; ++i) {
        //     expandedArg = expand(expression.args[i], environment);
        //     if (expandedArg && expandedArg.type === "[subst]") {
        //         expression.args[i] = expandedArg.value;
        //     }
        // }

        // if whitelist { if op.name in whitelist -- return evaluate op w/o whitelist; else return node }

        // what about strings?
        // stringPrimitives -- handle substitution and evaluation on their own
        // primitives -- hande evaluation on their own
        // macros -- permanent substitution on ast-level

        // special forms handle substitution and evaluation on their own (lazily)
        // definitely fun, mac should
        // note: this will make {a}[b c d] -> if[b c d] not work

        // preferably don't use regexes here
        // and optimize strings
        if (expression.operator.name && expression.operator.name === "'" || expression.operator.name === "html'") { // /^'|html'$/.test(expression.operator.name)) {
            //expression = substitute(expression, environment, branchId);
            var str = unparseString(quote(expression, environment, expression.operator.name), environment, branchId);
            return str.slice(str.search(/\[|\|/) + 1, str[str.length - 1] === ']'? -1: undefined);
        }

        // a procedure is immediately executed

        op = evaluate(expression.operator, environment, branchId);

        // function performApply(op, expression, environment) {
        //     var args = expression.args;

        //     if (op.type === "[macro]") {
        //         evaluate(op.value(args), environment);
        //     } else if (op.type === "[primitive]") {
        //         op.value(expression, environment)
        //     } else {
        //         // eval
        //         var argValues; // eval args in env
        //         op(...argValues);
        //     }

        // }

        // performApply(op, expression, environment);

        //if (typeof op !== 'function') {
            if (op && typeof op === 'object') { // non-null object
                if (op.type && op.type[0] === '[') { // TODO: implement this differently {tag} {type} {meta}
                    switch (op.type) {
                    case "[primitive]":
                        return op.value(expression, environment);
                    case "[subst]":
                        //op.value.operator = evaluate(op.value, environment);
                        op = evaluate(op.value, environment);
                        //op = op.value.operator;
                        break;
                    case "[macro]":
                        var expr = op.value(expression);

                        // if (expr.type === "[subst]") {
                        //     return evaluate(expr.value, environment);
                        // }
                        // todo: remove parents and make this substitution while evaluating args

                        //permanent substitution:
                        // if (expr.type !== '[macro]') {
                        //     expression.parent.args[branchId] = expr.value;//substitute(expr, environment, branchId);
                        //     expr.value.parent = expression.parent;
                        //     expr.value.operator.parent = expr.value.parent; // ?
                        //     //console.log(unparse(expr));
                        //     return evaluate(expr.value, environment, branchId);
                        // }
                        return expr; // ?
                    case "[invocation]":
                        context = op.context;
                        op = op.method;
                        // not decidedly an invocation of op is the user's intention here
                        // he may want to access op's properties
                        // because in js a function is also an object`
                        break;
                    // case "word": // ???
                    //     // handle {op[sth]}
                    //     expression.operator = op; // replace op
                    //     // evaluate and replace args
                    //     expression.args = expression.args.map((arg, i) => {
                    //         return evaluate(arg, environment, i);
                    //     });
                    //     return expression;
                    }
                } else { // makes op|x turn to op.x and op|x[y z x] turn to op.x(y, z, x)
                    var property, arg = expression.args[0];

                    //if (Number.isNaN(expression.args[0].value) && expression.args[0].type === "word") {
                    if (arg.value !== undefined) {
                        property = arg.value;
                    } else if (expression.args[0].type === "word") {
                        property = expression.args[0].name;
                    } else {
                        property = evaluate(expression.args[0], environment, 0);
                    }

                    if (Array.isArray(op) && Number.isInteger(property)) { // apply array -- get index
                        var length = op.length, index = property;

                        if (index < 0) { // negative indices mean offset from the end
                            // could do modulo instead error, but that might cause hard to find bugs
                            if (-index > length) {
                                return { type: "[error]", message: `negative indices are allowed and count from the end, but index ${index} is still out of bounds;` };
                            }
                            return op[length - index];
                        } else { // assuming index is integer > 0
                            if (index >= length) {
                                return { type: "[error]", message: `index ${index} is out of bounds` }
                            }
                            return op[index];
                        }
                    }

                    if (property in op || (property = toCamelCase(property)) in op) {
                        var ret = op[property]; // or evaluate expression.args[0]

                        // preserve context
                        if (typeof ret === "function") {
                            return { type: "[invocation]", context: op, method: ret };
                        }

                        return ret;
                    }
                    return { type: "[error]", message: `property ${property} not present in object` };
                }
            } else if (typeof op !== "function") {
                //
                // if macro, don't evaluate args; eval the macro, splice the returned ast in place and eval that
                // gotta keep track of macro's op -- root?
                // currentRoot.args[branchId] = returnedAst
                // else:
                console.log('type error 1:');
                console.log('applying a non-function:');
                console.log(op);
                throw new TypeError();
                return { type: "[error]", message: "applying a non-function (0)", data: [op] };
            }
        //}

        // not sure when this should happen
        //expression = substitute(expression, environment, branchId, ""); // this copies

        // scan args for meta first and evaluate that
        // for (i = 0; i < expression.args; ++i) {
        //     if (expression.args[i].type === "apply" && expression.args[i].operator.type === "meta") {
        //         evaluate(expression.args[i], environment, i);
        //     }
        // }
        // tests:
        // f[{{a} b c {d e}} f g {h {i j} k} l m n]

        // after there's no more meta arguments, evaluate as usual

        var j, evaluatedArgs = [], len = expression.args.length, arg;
        for (j = 0; j < len; ++j) {
            arg = evaluate(expression.args[j], environment, j);
            if (arg) {
                switch (arg.type) {
                case "[meta-apply]":
                    for (var i = 0; i < arg.value.length; ++i) {
                        if (Array.isArray(arg.value[i])) {
                            for (var k = 0; k < arg.value[i].length; ++k) {
                                evaluatedArgs.push(arg.value[k]);
                            }
                        } else {
                            evaluatedArgs.push(arg.value[i]);
                        }
                    }
                    break;
                case "[subst]":
                    expression.args[j] = arg.value; // permanent
                    evaluatedArgs.push(evaluate(arg.value, environment, j));
                    break;
                default:
                    evaluatedArgs.push(arg);
                    break;
                }
            } else {
                evaluatedArgs.push(arg); // RETURN_VALUE
            }
        }

        return op.apply(context, evaluatedArgs);

        // return op.apply(context, expression.args.map(function (arg, i) { // , i
        //     return evaluate(arg, environment, i);
        //     // identifying macros by return value:
        //     // if (Array.isArray(ret) && ret[1] is code) { // ret[1].type === "{code}"
        //     //     expression.args[i] = ret[1]; // no branch or parent nonsense
        //     //     return evaluate(ret[1], environment, i);
        //     // } else if (ret is code) {
        //     //     expression.args[i] = code; // no branch or parent nonsense
        //     //     return evaluate(code, environment, i);
        //     // }
        // }));
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

    //   if (expression.operator.name in specialFormsArgumentNames) {
    //       arg_names = specialFormsArgumentNames[expression.operator.name];
    //   }

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
        <span class="prefix" style="display: none">${node.prefix}</span>
        <span class="word" title="${node.prefix}">${node.name}</span>
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

function error(message, data = []) {
    return { type: "[error]", message: message, data: data };
}

function getProperty(context, property) {
    if (property in context || (property = toCamelCase(property)) in context) {
        var ret = context[property];

        return ret;
    }
    return error(`property ${property} not found in context [0]`, [context]);
}

function getPropertyAt(context, args, env, i) {
    // get array at index
    var name, arg = args[i];

    if (Array.isArray(context) && Number.isInteger(arg.value)) {
        var length = context.length, index = arg.value;

        if (index < 0) { // negative indices mean offset from the end
            // could do modulo instead error, but that might cause hard to find bugs
            if (-index > length) {
                throw TypeError(`negative indices are allowed and count from the end, but index ${index} is still out of bounds;`);
                return { type: "[error]", message: `negative indices are allowed and count from the end, but index ${index} is still out of bounds;` };
            }
            return context[length - index];
        } else { // assuming index is integer > 0
            if (index >= length) {
                throw TypeError(`index ${index} is out of bounds`);
                return { type: "[error]", message: `index ${index} is out of bounds` }
            }
            return context[index];
        }
    } else if (arg.type === "word") {
        name = arg.name;
        //return getProperty(context, arg.name);
    } else {
        // so if you want a value of some variable to be a property name you need to use identity function on that variable
        name = evaluate(arg, env, i);
        //return getProperty(context, evaluate(arg, env, i));
    }

    if (name in context || (name = toCamelCase(name)) in context) {
        var ret = context[name];
        return ret;
    }

    throw TypeError(`property ${name} not found in context [0]`);
    return error(`property ${name} not found in context [0]`, [context]);
}

function setPropertyAt(context, args, env, i, value) {
    if (args[i].type === "word") {
        return context[args[i].name] = value;
    } else {
        // so if you want a value of some variable to be a property name you need to use identity function on that variable
        return context[evaluate(args[i], env, i)] = value;
    }
}
