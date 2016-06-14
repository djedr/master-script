iterativePostorder(node)
  s ← empty stack
  lastNodeVisited ← null
  while (not s.isEmpty() or node ≠ null)
    if (node ≠ null)
      s.push(node)
      node ← node.left
    else
      peekNode ← s.peek()
      // if right child exists and traversing node
      // from left child, then move right
      if (peekNode.right ≠ null and lastNodeVisited ≠ peekNode.right)
        node ← peekNode.right
      else
        visit(peekNode)
        lastNodeVisited ← s.pop()

function iterEvaluate(expression, env, branchId) {
    var stack = [], lastExpr = null, nextExpr;
    while (stack.length !== 0 || expression !== null) {
        if (expression !== null) {
            stack.push(expression);
            expression = expression.args[0];
        } else {
            nextExpr = stack[stack.length - 1];

            for (var i = 1; i < nextExpr.args.length; ++i) {
                if (nextExpr.args[i] && lastExpr !== nextExpr.args[i]) {
                    expression = nextExpr.args[i];
                } else {
                    doEval(nextExpr);
                    lastExpr = stack.pop();
                }
            }

            if (nextExpr.args[1] !== null && lastExpr !== nextExpr.args[1]) {
                expression = nextExpr.args[1];
            } else {
                doEval(nextExpr);
                lastExpr = stack.pop();
            }
        }
    }
}

eval(expr) {
    switch (type) {
        word:
            ret val;
        apply:
            eop = eval(op)
            eargs = args.map(eval);
            ret eop(eargs);
    }
}

function eval(expression, environment, branchId) {
    // addresses
    var BEGIN_EVALUATE = 0;
    var EVALUATE_OPERATOR = 1;
    var EVALUATE_MACRO = 2;
    var ARGUMENT_LOOP = 3;
    var EVALUATE_ARGUMENT = 4;
    var EVALUATE_PROPERTY_NAME = 5;
    var AFTER_EVALUATE_PROPERTY_NAME = 6;

    var RETURN_VALUE = null;

    var op, context, j, evaluatedArgs, property; // locals

    var stack = [];
    var frame = {
        parameters: {
            expression: expression,
            environment: environment,
            branchId: branchId
        },
        address: BEGIN_EVALUATE,
        locals: {
            op: op,
            context: context,
            j: j,
            evaluatedArgs: evaluatedArgs,
            property: property
        } // ?
    }
    stack.push(frame);

    while (stack.length > 0) {
        frame = stack.pop();

        // restore params
        expression = frame.parameters.expression;
        environment = frame.parameters.environment;
        branchId = frame.parameters.branchId;

        // restore locals
        op = frame.locals.op;
        context = frame.locals.context;
        j = frame.locals.j;
        evaluatedArgs = frame.locals.evaluatedArgs;
        property = frame.locals.property;

        switch (frame.address) {
            case BEGIN_EVALUATE: LABEL_BEGIN_EVALUATE: {
                // initialize locals
                op = frame.locals.op = null;
                context = frame.locals.context = null;
                j = frame.locals.j = null;
                evaluatedArgs = frame.locals.evaluatedArgs = null;
                property = frame.locals.property = null;

                switch (expression.type) {
                case "word":
                    // this allows redefining a number:
                    // bind should prevent user from defining numbers // bindNames
                    if (expression.name in environment) {
                        RETURN_VALUE = environment[expression.name];
                    } else if (isNaN(expression.value)) {
                        RETURN_VALUE = { type: "[error]", message: `reference error: ${expression.name}` };
                    } else {
                        RETURN_VALUE = expression.value;
                    }
                    break LABEL_BEGIN_EVALUATE;
                case "apply":
                    if (expression.operator.name && /^'|html'$/.test(expression.operator.name)) {
                        var str = unparseString(expression, environment, branchId);
                        RETURN_VALUE = str.slice(str.search(/\[|\|/) + 1, str[str.length - 1] === ']'? -1: undefined);
                        break LABEL_BEGIN_EVALUATE;
                    }

                    if (expression.operator.type === "word" && expression.operator.name in specialForms) {
                        RETURN_VALUE = specialForms[expression.operator.name](expression.args, environment);
                        break LABEL_BEGIN_EVALUATE;
                    }

                    // address EVALUATE_OPERATOR
                    frame = {
                        address: EVALUATE_OPERATOR,
                        parameters: {
                            expression: expression,
                            environment: environment,
                            branchId: branchId
                        },
                        locals: {
                            op: op,
                            context: context,
                            j: j,
                            evaluatedArgs: evaluatedArgs,
                            property: property
                        }
                    };
                    stack.push(frame);


                    // call yourself
                    frame = {
                        address: BEGIN_EVALUATE,
                        parameters: {
                            expression: expression.operator,
                            environment: environment,
                            branchId: branchId
                        },
                        locals: {
                            op: op,
                            context: context,
                            j: j,
                            evaluatedArgs: evaluatedArgs,
                            property: property
                        }
                    };
                    stack.push(frame);
                    // recur(expression.operator, environment, branchId);
                    break;
                }
            } break LABEL_BEGIN_EVALUATE;
            case EVALUATE_OPERATOR: LABEL_EVALUATE_OPERATOR: {
                op = RETURN_VALUE;

                if (op && typeof op === 'object') { // non-null object
                    if (op.type && op.type[0] === '[') { // TODO: implement this differently {tag} {type} {meta}
                        switch (op.type) {
                        case "[macro]":
                            var expr = op.value.apply(null, expression.args); // note: expr should be a local

                            // permanent substitution:
                            if (expr.type !== '[macro]') {
                                expression.parent.args[branchId] = expr;//substitute(expr, environment, branchId);
                                expr.parent = expression.parent;
                                expr.operator.parent = expr.parent; // ?

                                frame = {
                                    address: BEGIN_EVALUATE,
                                    parameters: {
                                        expression: expr,
                                        environment: environment,
                                        branchId: branchId
                                    },
                                    locals: {
                                        op: op,
                                        context: context,
                                        j: j,
                                        evaluatedArgs: evaluatedArgs,
                                        property: property
                                    }
                                };
                                stack.push(frame);
                                break LABEL_EVALUATE_OPERATOR;
                                //return evaluate(expr, environment, branchId);
                            }
                            RETURN_VALUE = expr; // ?
                            break LABEL_EVALUATE_OPERATOR;
                        case "[invocation]":
                            context = op.context;
                            op = op.method;
                            // not decidedly an invocation of op is the user's intention here
                            // he may want to access op's properties
                            // because in js a function is also an object`
                            frame = {
                                address: EVALUATE_MACRO,
                                parameters: {
                                    expression: expression,
                                    environment: environment,
                                    branchId: branchId
                                },
                                locals: {
                                    op: op,
                                    context: context,
                                    j: j,
                                    evaluatedArgs: evaluatedArgs,
                                    property: property
                                }
                            };
                            stack.push(frame);
                            break LABEL_EVALUATE_OPERATOR;
                        }
                    } else { // makes op|x turn to op.x and op|x[y z x] turn to op.x(y, z, x)
                        // address AFTER_EVALUATE_PROPERTY_NAME
                        frame = {
                            address: AFTER_EVALUATE_PROPERTY_NAME,
                            parameters: {
                                expression: expression,
                                environment: environment,
                                branchId: branchId
                            },
                            locals: {
                                op: op,
                                context: context,
                                j: j,
                                evaluatedArgs: evaluatedArgs,
                                property: property
                            }
                        };
                        stack.push(frame);

                        if (isNaN(expression.args[0].value) && expression.args[0].type === "word") {
                            property = expression.args[0].name;
                        } else {
                            // address EVALUATE_PROPERTY_NAME
                            frame = {
                                address: EVALUATE_PROPERTY_NAME,
                                parameters: {
                                    expression: expression,
                                    environment: environment,
                                    branchId: branchId
                                },
                                locals: {
                                    op: op,
                                    context: context,
                                    j: j,
                                    evaluatedArgs: evaluatedArgs,
                                    property: property
                                }
                            };
                            stack.push(frame);

                            frame = {
                                address: BEGIN_EVALUATE,
                                parameters: {
                                    expression: expression.args[0],
                                    environment: environment,
                                    branchId: 0
                                },
                                locals: {
                                    op: op,
                                    context: context,
                                    j: j,
                                    evaluatedArgs: evaluatedArgs,
                                    property: property
                                }
                            };
                            stack.push(frame);
                            break LABEL_EVALUATE_OPERATOR;
                        }
                    }
                } else if (typeof op !== "function") {
                    console.log('type error 1:');
                    console.log('applying a non-function:');
                    console.log(op);
                    RETURN_VALUE = { type: "[error]", message: "applying a non-function (0)", data: [op] };
                }
            } break LABEL_EVALUATE_OPERATOR;
            case EVALUATE_PROPERTY_NAME:
                property = RETURN_VALUE;
            break;
            case AFTER_EVALUATE_PROPERTY_NAME: LABEL_AFTER_EVALUATE_PROPERTY_NAME: {
                if (Array.isArray(op) && Number.isInteger(property)) { // apply array -- get index
                    var length = op.length, index = property; // note: aliases, so no need for them to be in locals

                    if (index < 0) { // negative indices mean offset from the end
                        // could do modulo instead error, but that might cause hard to find bugs
                        if (-index > length) {
                            RETURN_VALUE = { type: "[error]", message: `negative indices are allowed and count from the end, but index ${index} is still out of bounds;` };
                            break LABEL_AFTER_EVALUATE_PROPERTY_NAME;
                        }
                        RETURN_VALUE = op[length - index];
                        break LABEL_AFTER_EVALUATE_PROPERTY_NAME;
                    } else { // assuming index is integer > 0
                        if (index >= length) {
                            RETURN_VALUE = { type: "[error]", message: `index ${index} is out of bounds` };
                            break LABEL_AFTER_EVALUATE_PROPERTY_NAME;
                        }
                        RETURN_VALUE = op[index];
                        break LABEL_AFTER_EVALUATE_PROPERTY_NAME;
                    }
                }

                if (property in op || (property = toCamelCase(property)) in op) {
                    var ret = op[property]; // or evaluate expression.args[0]

                    // preserve context
                    if (typeof ret === "function") {
                        RETURN_VALUE = { type: "[invocation]", context: op, method: ret };
                        break LABEL_AFTER_EVALUATE_PROPERTY_NAME;
                    }

                    RETURN_VALUE = ret;
                    break LABEL_AFTER_EVALUATE_PROPERTY_NAME;
                }
                RETURN_VALUE = { type: "[error]", message: `property ${property} not present in object` };
            } break LABEL_AFTER_EVALUATE_PROPERTY_NAME;
            case EVALUATE_MACRO: LABEL_EVALUATE_MACRO: {
                // not sure when this should happen
                expression = substitute(expression, environment, branchId, ""); // this copies and is mutually recursive

                j = 0;
                evaluatedArgs = [];

            //     frame = {
            //         address: ARGUMENT_LOOP,
            //         parameters: {
            //             expression: expression,
            //             environment: environment,
            //             branchId: branchId
            //         },
            //         locals: {
            //             op: op,
            //             context: context,
            //             j: j,
            //             evaluatedArgs: evaluatedArgs
            //         }
            //     };
            //     stack.push(frame);
            // break;
            } // fallthrough EVALUATE_MACRO
            case ARGUMENT_LOOP:
                if (j < expression.args.length) {
                    // address ARGUMENT_LOOP
                    frame = {
                        address: ARGUMENT_LOOP,
                        parameters: {
                            expression: expression,
                            environment: environment,
                            branchId: branchId
                        },
                        locals: {
                            op: op,
                            context: context,
                            j: j,
                            evaluatedArgs: evaluatedArgs,
                            property: property
                        }
                    };
                    stack.push(frame);

                    // address EVALUATE_ARGUMENT
                    frame = {
                        address: EVALUATE_ARGUMENT,
                        parameters: {
                            expression: expression,
                            environment: environment,
                            branchId: branchId
                        },
                        locals: {
                            op: op,
                            context: context,
                            j: j,
                            evaluatedArgs: evaluatedArgs,
                            property: property
                        }
                    };
                    stack.push(frame);

                    frame = {
                        address: BEGIN_EVALUATE,
                        parameters: {
                            expression: expression.args[j],
                            environment: environment,
                            branchId: j
                        },
                        locals: {
                            op: op,
                            context: context,
                            j: j,
                            evaluatedArgs: evaluatedArgs,
                            property
                        }
                    };
                    stack.push(frame);
                    break ARGUMENT_LOOP;
                    //evaluate(expression.args[j], environment, j)
                }

                RETURN_VALUE = op.apply(context, evaluatedArgs);
                break ARGUMENT_LOOP;
            case EVALUATE_ARGUMENT: LABEL_EVALUATE_ARGUMENT: {
                evaluatedArgs.push(RETURN_VALUE);
                ++j;
            } break LABEL_EVALUATE_ARGUMENT;
        }
    }

    if (RETURN_VALUE.type && RETURN_VALUE.type === "[error]") {
        throw new TypeError(RETURN_VALUE.message);
    }

    return RETURN_VALUE;
}

function eval(expr, env) {
    var exprArgsStack = [], exprStack = [], lastExprOpId, lastExprArgs, nextOpExpr, nextArgExpr, exprOp, opStack = [], argsStack = [], op, args, arg, lastArgs, a;


    // ari['|*][+[a b] c]

    // ari: fun-ari(s)
    // ': { type: "[special]", value: fun'(...args) }
    // *: fun*(a, b)
    // +: fun+(a, b)
    // a: 1
    // b: 2
    // c: 3

    if (expr.type === "word") {
        return env[expr.name];
    }

    exprStack.push(expr); // exprStack = `ari['|*][+[a b] c]`
    exprArgsStack.push(expr.args); // exprArgsStack = [`[+[a b] c]`];
    exprOp = expr.operator; // exprOp = `ari['|*]`;

    // 0: exprStack = [`ari['|*][+[a b] c]`]; 1: exprStack = [`ari['|*][+[a b] c]`, `'|*`]
    // 2: exprStack = [`ari['|*][+[a b] c]`, `'|*`]
    while (exprStack.length > 0) {
        nextOpExpr = exprOp; // 0: nextOpExpr: `ari['|*]`; 1: nextOpExpr = `'`

        while (nextOpExpr.type !== "word") { // 0.0: true; 0.1: false; 1.0: false
            nextOpExpr = exprOp.operator; // 0.0: nextOpExpr = `ari`
            nextArgExpr = exprOp.args; // 0.0: nextArgExpr = `['|*]`
            exprOp = nextOpExpr; // 0.0: exprOp = `ari`;
            exprArgsStack.push(nextArgExpr); // 0.0: exprArgsStack = [`[+[a b] c]`, `['|*]`]

            nextOpExpr = exprOp; // 0: nextOpExpr = `ari`;
        }

        op = env[nextOpExpr.name]; // 0: op = fun-ari(s); 1: op = special-fun'
        opStack.push(op); // 0: opStack = [fun-ari(s)]; 1: opStack = [fun-ari(s), special-fun']
        argsStack.push([]); // 0: argsStack = [[]]; 1: argsStack = [[], []]
        lastArgs = argsStack.length - 1; // 0: lastArgs = 0; 1: lastArgs = 1
        lastExprArgs = exprArgsStack.length - 1;

        exprArgs = exprArgsStack[lastExprArgs]; // 0: exprArgs = `['|*]`; 1: exprArgs: `|*`
        args = argsStack[lastArgs]; // 0: args = []; 1: args = []

        if (op.type && op.type === "[special]") { // 1: true
            arg = op.value.apply(null, exprArgs); // 1: arg = '*'
            if (lastArgs >= 0) { // 1: true
                argsStack[lastArgs].push(arg); // 1: argsStack = [[], ['*']]
            }
        } else {
            for (var i = 0; i < args.length; ++i) {
                a = args[i] // 0.0: a = `'|*`; 1.0: `*`
                if (a.type === "word") { // 0.0: false; 1.0: true
                    arg = env[arg];     // 1.0: arg =
                    argsStack[lastArgs].push(arg); // 0.1: argsStack = [[3]]; 1.0: argsStack = [[3], [1]]; 1.1: argsStack = [[3], [1 2]]
                } else {
                    exprStack.push(arg) // 0.0: exprStack = [`ari['|*][+[a b] c]`, `'|*`]
                    exprOp = arg.operator; // 0.0: exprOp = `'`
                    exprArgsStack.push(arg.args); // 0.0: exprArgsStack = [`[+[a b] c]`, `['|*]`, `*`]
                }
            }

            while (exprStack.length === 0) { // 0: false
                op = opStack.pop(); // 1.0: op = fun+, opStack = [fun*]; 1.1: op = fun*, opStack = []
                args = argsStack.pop(); // 1.0: args = [1 2], argsStack = [3]; 1.1: args = [3 3], argsStack = []
                --lastArgs; // 1.0: lastArgs = 0; 1.1: lastArgs = -1
                arg = op.apply(null, args); // 1.0: arg = 3; 1.1: arg = 9
                if (lastArgs >= 0) { // 1.0: true; 1.1: false
                    argsStack[lastArgs].push(arg); // 1.0: argsStack = [[3 3]]
                }
            }
        }
    }
    return arg; // 9
}

function evaluate(expression, environment, branchId) { // , root/currentRoot, branchId
    var op, context = null;

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
        } else if (isNaN(expression.value)) {
            console.log('reference error 1:');
            console.log(expression.name);
            throw new TypeError(`reference error: ${expression.name}`);
            return { type: "[error]", message: `reference error: ${expression.name}` };
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
        if (expression.operator.name && /^'|html'$/.test(expression.operator.name)) {
            //expression = substitute(expression, environment, branchId);
            var str = unparseString(expression, environment, branchId);
            return str.slice(str.search(/\[|\|/) + 1, str[str.length - 1] === ']'? -1: undefined);
        }

        if (expression.operator.type === "word" && expression.operator.name in specialForms) {
            return specialForms[expression.operator.name](expression.args, environment);
        }

        op = evaluate(expression.operator, environment, branchId);
        //if (typeof op !== 'function') {
            if (op && typeof op === 'object') { // non-null object
                if (op.type && op.type[0] === '[') { // TODO: implement this differently {tag} {type} {meta}
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
                    var property;

                    if (isNaN(expression.args[0].value) && expression.args[0].type === "word") {
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
                console.log('type error 1:');
                console.log('applying a non-function:');
                console.log(op);
                return { type: "[error]", message: "applying a non-function (0)", data: [op] };
            }
        //}

        // not sure when this should happen
        expression = substitute(expression, environment, branchId, ""); // this copies

        var j, evaluatedArgs = [], len = expression.args.length;
        for (j = 0; j < len; ++j) {
            evaluatedArgs.push(evaluate(expression.args[j], environment, j));
        }

        return op.apply(context, evaluatedArgs);
    }
}