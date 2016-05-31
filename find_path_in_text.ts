
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
  // for (i = 0; expression_string[0] != "]"; ++i)
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

function parse_to_find(expression_string, path_to_find) {
  var path = "0",
      paths = [],
      tree = {},
      result, separated;

  paths.push(path);
  result = parseExpression(expression_string, tree, paths, path, path_to_find);
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