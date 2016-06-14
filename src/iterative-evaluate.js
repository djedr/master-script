function evaluate_(expression, environment, branchId) {
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
                case "meta":
                    RETURN_VALUE = function(...args) {
                        return {type: "[meta-apply]", value: args};
                    };
                    break LABEL_BEGIN_EVALUATE;
                case "word":
                    // this allows redefining a number:
                    // bind should prevent user from defining numbers // bindNames
                    if (expression.name in environment) {
                        RETURN_VALUE = environment[expression.name];
                    } else if (isNaN(expression.value)) {
                        RETURN_VALUE = { type: "[error]", message: `reference error: ${expression.name}` };
                        throw new TypeError();
                    } else {
                        RETURN_VALUE = expression.value;
                    }
                    break LABEL_BEGIN_EVALUATE;
                case "apply":
                    if (expression.operator.name && /^'|html'$/.test(expression.operator.name)) {
                        var str = unparseString(quote(expression, environment, expression.operator.name), environment, branchId);
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
                    break LABEL_BEGIN_EVALUATE;
                }
            } break;// LABEL_BEGIN_EVALUATE;
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
                        break LABEL_EVALUATE_OPERATOR;
                    }
                } else if (typeof op !== "function") {
                    console.log('type error 1:');
                    console.log('applying a non-function:');
                    console.log(op);
                    RETURN_VALUE = { type: "[error]", message: "applying a non-function (0)", data: [op] };
                    break LABEL_EVALUATE_OPERATOR;
                }

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
            } break;// LABEL_EVALUATE_OPERATOR;
            case EVALUATE_PROPERTY_NAME:
                property = RETURN_VALUE;
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
            } break;// LABEL_AFTER_EVALUATE_PROPERTY_NAME;
            case EVALUATE_MACRO: LABEL_EVALUATE_MACRO: {
                j = 0;
                evaluatedArgs = [];
            } // fallthrough EVALUATE_MACRO
            case ARGUMENT_LOOP:
                if (j < expression.args.length) {

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
                    break;// ARGUMENT_LOOP;
                    //evaluate(expression.args[j], environment, j)
                }

                RETURN_VALUE = op.apply(context, evaluatedArgs);
                break;// ARGUMENT_LOOP;
            case EVALUATE_ARGUMENT:
                var arg = RETURN_VALUE;
                if (arg && arg.type === "[meta-apply]") {
                    for (var i = 0; i < arg.value.length; ++i) {
                        if (Array.isArray(arg.value[i])) {
                            for (var k = 0; k < arg.value[i].length; ++k) {
                                evaluatedArgs.push(arg.value[k]);
                            }
                        } else {
                            evaluatedArgs.push(arg.value[i]);
                        }
                    }
                } else {
                    evaluatedArgs.push(arg); // RETURN_VALUE
                }
                ++j;

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
                break; // EVALUATE_ARGUMENT
        }
    }

    if (RETURN_VALUE && RETURN_VALUE.type && RETURN_VALUE.type === "[error]") {
        throw new TypeError(RETURN_VALUE.message);
    }

    return RETURN_VALUE;
}