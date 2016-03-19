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

function parseApply(expression, expression_string) {
  var arg, separated, separator_cached;

  separated = separate(expression_string);
  expression_string = separated.expression_string;

  if (expression_string[0] != "[") {
    expression.postfix += separated.separator;
    return { expression: expression, rest: expression_string };
  }
  separator_cached = separated.separator;

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

  while (expression_string[0] != "]") {
    arg = parseExpression(expression_string);
    separated = separate(arg.rest);
    expression_string = separated.expression_string;
    arg.expression.prefix += separator_cached;

    separator_cached = separated.separator;

    expression.args.push(arg.expression);
  }
  expression.postfix += separator_cached + "]";
  return parseApply(expression, expression_string.slice(1));
}

function parseExpression(expression_string) {
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

  return parseApply(expression, expression_string.slice(match[0].length));
}

function parse(expression_string) {
  var result = parseExpression(expression_string), separated = separate(result.rest);
  if (separated.expression_string.length > 0) {
      console.log('syntax error 3:');
      console.log(expression_string);
      return null;
  }
  result.expression.prefix += separated.separator;
  return result.expression;
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
        <span style="display: none">${expression.postfix}</span>
      `;

      return result;
    case "apply":
        var color = 7;//Math.floor(Math.random() * 5) + 5;
        var color2 = 8;//Math.floor(Math.random() * 5) + 5;
        var color3 = 9;//Math.floor(Math.random() * 5) + 5;
      result += `
        <!--<td class="output-connection-cell">
			<div class="output-connection-div">
				<span class="any-icon" style="width: 0.33em; height: 30%; position: absolute; top: 29%; left: 0em; display: inline-block; z-index: 5; border: 1px solid; border-right: 0; opacity: 0.66"></span>
			
				<span class="icon any-icon" style="margin-left: 0.33em; border-left: 1px solid;">a</span>
				<span class="output-connection-name">any</span>
			</div>
        </td>
        <td class="call-cell">-->
            <table class="call-table">
                <tr class="operator-row">
                    <td class="operator-cell">
                        <div class="operator-div">
                            ${visualise(expression.operator, environment)}
                        </div>
                    </td>
                    <!--<td class="input-connection-cell">
                        <div class="input-connection-div">
                            <span class="input-connection-name">function</span>
                            <span class="icon any-icon" style="border-right: 1px solid;">f</span>
                            
                            <span class="any-icon" style="top: 0; width: 0.33em; height: 28%; right: -0.33em; position: absolute; display: inline-block; z-index: 5; border-right: 1px solid; border-bottom: 1px solid; opacity: 0.66"></span>
                            <span class="any-icon" style="bottom: 0; width: 0.33em; height: 28%; right: -0.33em; position: absolute; display: inline-block; z-index: 5; border-right: 1px solid; border-top: 1px solid; opacity: 0.66"></span>
                        </div>
                    </td>-->
                </tr>
      `; // arguments
      
      if (expression.operator.name in specialFormsArgumentNames) {
          arg_names = specialFormsArgumentNames[expression.operator.name];
      }
          
      expression.args.map(function (arg, i) {
        var color = '9';//Math.floor(Math.random() * 5) + 5;
        var color2 = 'a';//Math.floor(Math.random() * 5) + 5;
        var color3 = 'b';//Math.floor(Math.random() * 5) + 5;
        var title = //('<small style="color: #444">' + 
                     `${expression.operator.name}@${i}:${arg_names[i] || '(value)'}`
                    //+ '</small>')
                    ;
        //+ (arg_names[i] || i) +
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
                </td>
                <td class="call-cell">
                ${arg.type === 'word' ?
                    `
                    <table class="call-table">
                        <tr class="operator-row">
                            <td class="operator-cell">
                                <div class="operator-div">`
                                    + visualise(arg, environment)
                                + `
                                </div>
                            </td>
                        </td>
                    </table>`
                    : visualise(arg, environment)}
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
					</td>
                </tr>
            </table>
        <!--</td>-->`;
  }
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


specialFormsArgumentNames["define"] = ["name"];
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
    document.getElementById('console-output').innerHTML += value + '\n';
    
    console.log(document.getElementById('console-output').innerHTML);

    return value;
};

specialForms["block"] = function (args, env) {
    return args[0];
}

specialForms["comment"] = function (args, env) {
    return null;
}