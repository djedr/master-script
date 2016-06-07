// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

// Mathematica mode copyright (c) 2015 by Calin Barbat
// Based on code by Patrick Scheibe (halirutan)
// See: https://github.com/halirutan/Mathematica-Source-Highlighting/tree/master/src/lang-mma.js

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
        mod(require("../node_modules/codemirror/lib/codemirror"));
    else if (typeof define == "function" && define.amd) // AMD
        define(["../node_modules/codemirror/lib/codemirror"], mod);
    else // Plain browser env
        mod(CodeMirror);
})(function(CodeMirror) {
"use strict";

CodeMirror.defineMode('dual', function(_config, _parserConfig) {
    var wordRegexPart = String.raw`[^\s\[\]!{\}\|]+`;
    var wordRegex = RegExp(String.raw`(?:${wordRegexPart})`);
    var singleWordStringRegex = RegExp(String.raw`(?:'\s*\|${wordRegexPart})`);

    function tokenBase(stream, state) {
        var word;

        function meta(className) {
            return className + state.metaClass;
        }

        // block comment
        if (stream.match(/(?:--\[)/, true, false)) {
            state.commentLevel++;
            state.tokenize = tokenBlock("comment");
            return state.tokenize(stream, state);
        }

        // line comment
        if (stream.match(/(?:--[^\n]*)/, true, false)) {
            return "comment";
        }

        // string/html string -- todo: make html inner mode
        if (stream.match(/(?:(html|)'\s*\[)/, true, false)) {
            state.commentLevel++;
            state.tokenize = tokenBlock("string");
            return state.tokenize(stream, state);
        }

        // single word string
        if (stream.match(singleWordStringRegex, true, false)) {
            return "string single-word";
        }

        // meta
        if (stream.match(/(?:\{)/, true, false)) {
            state.metaLevel++;

            if (state.metaLevel > 0) {
                state.metaClass = " meta";
            }
            return "meta";
        }
        if (stream.match(/(?:\})/, true, false)) {
            state.metaLevel--;

            if (state.metaLevel <= 0) {
                state.metaClass = "";
            }
            return "meta";
        }

        // access/assignment
        if (stream.match(/(?:\.|\:)/, true, false)) {
            return "access-or-assign";
        }

        // single or zero argument invocation
        if (stream.match(/(?:!)/, true, false)) {
            return meta('invocation0');
        }

        // single or multiargument invocation
        if (stream.match(/(?:\[|\]|\|)/, true, false)) {
            return meta('bracket');
        }

        // word
        word = stream.match(wordRegex, true, false);
        if (word) {
            if (isNaN(Number(word)) === false) {
                return meta("number");
            } if (["bind", "match"].indexOf(word[0]) !== -1) {
                return meta('bind');
            } else if (["of", "if"].indexOf(word[0]) !== -1) {
                return meta('predefined');
            } else if (["=", ">=", ">", "<", "<=", "<>"].indexOf(word[0]) !== -1) {
                return meta('logic');
            } else if (["+", "-", "*", "/", "^"].indexOf(word[0]) !== -1) {
                return meta('arithmetic');
            } else if (word[0][word[0].length - 1] === "*") {
                return meta('keyword');
            }
            return meta('variable');
        }

        // everything else is an error
        return 'error';
    }

    function tokenBlock(className, open = "[", close = "]") {
        return function (stream, state) {
            var next;

            while (state.commentLevel > 0 && (next = stream.next()) != null) {
                // if (next === "{") {
                //     state.metaLevel++;
                //     if (state.metaLevel > 0) {
                //         state.metaClass = " meta";
                //     }
                // } else if (next === "}") {
                //     state.metaLevel--;

                //     if (state.metaLevel <= 0) {
                //         state.metaClass = "";
                //     }
                //     return "meta";
                // } else
                if (next === open) state.commentLevel++;
                else if (next === close) state.commentLevel--;
            }
            if (state.commentLevel <= 0) {
                state.tokenize = tokenBase;
            }
            return className + state.metaClass;
        }
    }

    return {
        startState: function() {
            return {
                tokenize: tokenBase,
                commentLevel: 0,
                metaLevel: 0,
                metaClass: ""
            };
        },
        token: function(stream, state) {
            if (stream.eatSpace()) return null;
            return state.tokenize(stream, state);
        },
        blockCommentStart: "--[",
        blockCommentEnd: "]"
    };
});

CodeMirror.defineMIME('text/x-dual', {
    name: 'dual'
});

});
