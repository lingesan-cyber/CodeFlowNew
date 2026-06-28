"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenize = tokenize;
function tokenize(code, lang, isLine) {
    if (isLine === void 0) { isLine = false; }
    var tokens = [];
    var line = 1;
    var col = 1;
    var i = 0;
    var keywords = new Set([
        'let', 'var', 'const', 'function', 'return', 'if', 'else', 'for', 'while', 'new', 'free',
        'def', 'class', 'int', 'float', 'double', 'char', 'void', 'struct', 'Scanner', 'System',
        'out', 'println', 'print', 'printf', 'scanf', 'cin', 'cout', 'include', 'import', 'from',
        'delete', 'in', 'range', 'elif', 'and', 'or', 'not', 'nullptr', 'NULL', 'true', 'false',
        'bool', 'boolean', 'String', 'prompt', 'using', 'namespace', 'True', 'False', 'None', 'break',
        'try', 'except', 'continue', 'pass', 'yield', 'with', 'as', 'finally', 'throw', 'throws',
        'catch', 'switch', 'case', 'default', 'final', 'instanceof', 'static', 'abstract', 'do',
        'lambda', 'async', 'await', 'override', 'extends', 'implements', 'super', 'public', 'private',
        'protected', 'null', 'raise'
    ]);
    // Strip single-line and multi-line comments first or skip them in tokenization
    while (i < code.length) {
        var char = code[i];
        // Handle newlines
        if (char === '\n') {
            tokens.push({ type: 'NEWLINE', value: '\n', line: line, col: col, index: i });
            line++;
            col = 1;
            i++;
            continue;
        }
        if (char === '\r') {
            i++;
            continue;
        }
        // Skip whitespace (except for indentation logic, handled separately for Python if needed)
        if (char === ' ' || char === '\t') {
            i++;
            col++;
            continue;
        }
        // Comments check
        if (lang !== 'python' && char === '/' && code[i + 1] === '/') {
            while (i < code.length && code[i] !== '\n') {
                i++;
            }
            continue;
        }
        if (char === '/' && code[i + 1] === '*') {
            i += 2;
            while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) {
                if (code[i] === '\n') {
                    line++;
                    col = 1;
                }
                else {
                    col++;
                }
                i++;
            }
            i += 2;
            col += 2;
            continue;
        }
        if (char === '#') { // Python comment
            while (i < code.length && code[i] !== '\n') {
                i++;
            }
            continue;
        }
        // F-strings: f"..." or f'...' — lex as a STRING token with f-prefix marker
        if ((char === 'f' || char === 'F') && (code[i + 1] === '"' || code[i + 1] === "'")) {
            var quote = code[i + 1];
            var val = '';
            var startCol = col;
            i += 2;
            col += 2; // skip f and opening quote
            while (i < code.length && code[i] !== quote) {
                val += code[i];
                if (code[i] === '\n') {
                    line++;
                    col = 1;
                }
                else
                    col++;
                i++;
            }
            i++;
            col++; // skip end quote
            tokens.push({ type: 'STRING', value: '\x00FSTR\x00' + val, line: line, col: startCol, index: i });
            continue;
        }
        // Strings
        if (char === '"' || char === "'") {
            var quote = char;
            var val = '';
            var startCol = col;
            i++;
            col++;
            while (i < code.length && code[i] !== quote) {
                val += code[i];
                if (code[i] === '\n') {
                    line++;
                    col = 1;
                }
                else {
                    col++;
                }
                i++;
            }
            i++;
            col++; // skip end quote
            tokens.push({ type: 'STRING', value: val, line: line, col: startCol, index: i });
            continue;
        }
        // Numbers
        if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(code[i + 1] || ''))) {
            var val = '';
            var startCol = col;
            while (i < code.length && /[0-9.]/.test(code[i])) {
                val += code[i];
                i++;
                col++;
            }
            if (i < code.length && (code[i] === 'f' || code[i] === 'F')) {
                i++;
                col++;
            }
            tokens.push({ type: 'NUMBER', value: val, line: line, col: startCol, index: i });
            continue;
        }
        // Identifiers & Keywords
        if (/[a-zA-Z_]/.test(char)) {
            var val = '';
            var startCol = col;
            while (i < code.length && /[a-zA-Z0-9_]/.test(code[i])) {
                val += code[i];
                i++;
                col++;
            }
            var type = keywords.has(val) ? 'KEYWORD' : 'IDENTIFIER';
            tokens.push({ type: type, value: val, line: line, col: startCol, index: i });
            continue;
        }
        // Operators
        var tripleOps = ['===', '!==', '...'];
        var subStr3 = code.slice(i, i + 3);
        if (tripleOps.includes(subStr3)) {
            tokens.push({ type: 'OPERATOR', value: subStr3, line: line, col: col, index: i });
            i += 3;
            col += 3;
            continue;
        }
        var multiOps = ['=>', '**', '==', '!=', '<=', '>=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '->', '<<', '>>', '++', '--', '::', '//', '..'];
        var subStr = code.slice(i, i + 2);
        if (multiOps.includes(subStr)) {
            tokens.push({ type: 'OPERATOR', value: subStr, line: line, col: col, index: i });
            i += 2;
            col += 2;
            continue;
        }
        var singleOps = ['=', '+', '-', '*', '/', '%', '<', '>', '&', '!', '|', '^', '~', '?', ':', '@'];
        if (singleOps.includes(char)) {
            tokens.push({ type: 'OPERATOR', value: char, line: line, col: col, index: i });
            i++;
            col++;
            continue;
        }
        // Punctuation
        var punc = ['(', ')', '{', '}', '[', ']', ';', ',', '.'];
        if (punc.includes(char)) {
            tokens.push({ type: 'PUNCTUATION', value: char, line: line, col: col, index: i });
            i++;
            col++;
            continue;
        }
        // Unknown characters
        i++;
        col++;
    }
    // Deduce indentation blocks for Python
    if (lang === 'python' && !isLine) {
        return processPythonIndentation(code);
    }
    // Filter out excessive newlines
    var filtered = tokens.filter(function (t) { return t.type !== 'NEWLINE'; });
    filtered.push({ type: 'EOF', value: '', line: line, col: col, index: i });
    return filtered;
}
function processPythonIndentation(code) {
    var lines = code.split('\n');
    var result = [];
    var indentStack = [0];
    var lineNum = 1;
    var nestingDepth = 0;
    for (var l = 0; l < lines.length; l++) {
        var rawLine = lines[l];
        lineNum = l + 1;
        // Skip empty lines or comment-only lines
        var trimmed = rawLine.trim();
        if (trimmed === '' || trimmed.startsWith('#')) {
            continue;
        }
        // Count indentation
        var indent = 0;
        for (var c = 0; c < rawLine.length; c++) {
            if (rawLine[c] === ' ') {
                indent++;
            }
            else if (rawLine[c] === '\t') {
                indent += 4; // Tab size 4
            }
            else {
                break;
            }
        }
        // Emit INDENT or DEDENT tokens only if nesting level is 0
        if (nestingDepth === 0) {
            var currentIndent = indentStack[indentStack.length - 1];
            if (indent > currentIndent) {
                indentStack.push(indent);
                result.push({ type: 'INDENT', value: indent.toString(), line: lineNum, col: 1, index: 0 });
            }
            else if (indent < currentIndent) {
                while (indentStack.length > 0 && indentStack[indentStack.length - 1] > indent) {
                    indentStack.pop();
                    result.push({ type: 'DEDENT', value: indent.toString(), line: lineNum, col: 1, index: 0 });
                }
            }
        }
        // Tokenize line content
        var lineTokens = tokenizeLine(rawLine.slice(indent), lineNum, indent + 1);
        result.push.apply(result, lineTokens);
        // Track nesting level
        for (var _i = 0, lineTokens_1 = lineTokens; _i < lineTokens_1.length; _i++) {
            var token = lineTokens_1[_i];
            if (token.type === 'PUNCTUATION') {
                if (['(', '[', '{'].includes(token.value)) {
                    nestingDepth++;
                }
                else if ([')', ']', '}'].includes(token.value)) {
                    nestingDepth = Math.max(0, nestingDepth - 1);
                }
            }
        }
        // Emit NEWLINE only if nesting depth is 0 at the end of the line
        if (nestingDepth === 0) {
            result.push({ type: 'NEWLINE', value: '\n', line: lineNum, col: rawLine.length + 1, index: 0 });
        }
    }
    // Dedent everything at the end
    while (indentStack.length > 1) {
        indentStack.pop();
        result.push({ type: 'DEDENT', value: '0', line: lineNum + 1, col: 1, index: 0 });
    }
    result.push({ type: 'EOF', value: '', line: lineNum + 1, col: 1, index: 0 });
    return result;
}
// Tokenizes a single line (helper for python)
function tokenizeLine(lineText, line, startCol) {
    // We can just use the core tokenize function and shift their cols
    var tokens = tokenize(lineText, 'python', true);
    return tokens
        .filter(function (t) { return t.type !== 'EOF' && t.type !== 'NEWLINE'; })
        .map(function (t) { return (__assign(__assign({}, t), { line: line, col: t.col + startCol - 1 })); });
}
