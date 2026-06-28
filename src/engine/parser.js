"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseParser = void 0;
var lexer_1 = require("./lexer");
var BaseParser = /** @class */ (function () {
    function BaseParser(code, lang) {
        this.tokens = [];
        this.cursor = 0;
        this.lang = lang;
        this.tokens = (0, lexer_1.tokenize)(code, lang);
    }
    BaseParser.prototype.peek = function (offset) {
        var _a, _b, _c;
        if (offset === void 0) { offset = 0; }
        var idx = this.cursor + offset;
        if (idx >= this.tokens.length) {
            return {
                type: 'EOF',
                value: '',
                line: ((_a = this.tokens[this.tokens.length - 1]) === null || _a === void 0 ? void 0 : _a.line) || 1,
                col: ((_b = this.tokens[this.tokens.length - 1]) === null || _b === void 0 ? void 0 : _b.col) || 1,
                index: ((_c = this.tokens[this.tokens.length - 1]) === null || _c === void 0 ? void 0 : _c.index) || 0
            };
        }
        return this.tokens[idx];
    };
    BaseParser.prototype.next = function () {
        var t = this.peek();
        this.cursor++;
        return t;
    };
    BaseParser.prototype.match = function (type, value) {
        var t = this.peek();
        if (t.type !== type)
            return false;
        if (value !== undefined && t.value !== value)
            return false;
        return true;
    };
    BaseParser.prototype.consume = function (type, value) {
        var t = this.peek();
        if (t.type !== type) {
            throw new Error("Expected token type ".concat(type, " but got ").concat(t.type, " (value: \"").concat(t.value, "\") at line ").concat(t.line, ", col ").concat(t.col));
        }
        if (value !== undefined && t.value !== value) {
            throw new Error("Expected token \"".concat(value, "\" but got \"").concat(t.value, "\" at line ").concat(t.line, ", col ").concat(t.col));
        }
        return this.next();
    };
    BaseParser.prototype.getLoc = function (startToken) {
        var current = this.peek();
        return {
            line: startToken.line,
            columnStart: startToken.col,
            columnEnd: current.col + (current.value.length || 0)
        };
    };
    BaseParser.prototype.parseStatement = function () {
        throw new Error("parseStatement not implemented in base parser");
    };
    BaseParser.prototype.isArrowFunction = function () {
        var depth = 0;
        var idx = 0;
        var firstTok = this.peek(0);
        var secondTok = this.peek(1);
        if (firstTok.type === 'IDENTIFIER' && secondTok.type === 'OPERATOR' && (secondTok.value === '=>' || secondTok.value === '->')) {
            return true;
        }
        while (true) {
            var tok = this.peek(idx);
            if (tok.type === 'EOF' || tok.type === 'NEWLINE' || (tok.type === 'PUNCTUATION' && (tok.value === ';' || tok.value === '{' || tok.value === '}')))
                break;
            if (tok.type === 'PUNCTUATION' && tok.value === '(')
                depth++;
            else if (tok.type === 'PUNCTUATION' && tok.value === ')') {
                depth--;
                if (depth === 0) {
                    var nextTok = this.peek(idx + 1);
                    if (nextTok.type === 'OPERATOR' && (nextTok.value === '=>' || nextTok.value === '->')) {
                        return true;
                    }
                    break;
                }
            }
            idx++;
        }
        return false;
    };
    // Expression Parsing (Precedence / Pratt parsing)
    BaseParser.prototype.parseExpression = function () {
        return this.parseAssignment();
    };
    BaseParser.prototype.parseAssignment = function () {
        var left = this.parseLogicalOr();
        var isAssignOp = this.match('OPERATOR', '=') ||
            this.match('OPERATOR', '+=') ||
            this.match('OPERATOR', '-=') ||
            this.match('OPERATOR', '*=') ||
            this.match('OPERATOR', '/=') ||
            this.match('OPERATOR', '%=');
        if (isAssignOp) {
            var opToken = this.next();
            var right = this.parseAssignment();
            return {
                type: 'BinaryOp',
                left: left,
                operator: opToken.value,
                right: right,
                loc: {
                    line: left.loc.line,
                    columnStart: left.loc.columnStart,
                    columnEnd: right.loc.columnEnd
                }
            };
        }
        return left;
    };
    BaseParser.prototype.parseLogicalOr = function () {
        var left = this.parseLogicalAnd();
        while (this.match('OPERATOR', '||') || (this.lang === 'python' && this.match('KEYWORD', 'or'))) {
            var opToken = this.next();
            var right = this.parseLogicalAnd();
            left = {
                type: 'BinaryOp',
                left: left,
                operator: opToken.value,
                right: right,
                loc: {
                    line: left.loc.line,
                    columnStart: left.loc.columnStart,
                    columnEnd: right.loc.columnEnd
                }
            };
        }
        return left;
    };
    BaseParser.prototype.parseLogicalAnd = function () {
        var left = this.parseEquality();
        while (this.match('OPERATOR', '&&') || (this.lang === 'python' && this.match('KEYWORD', 'and'))) {
            var opToken = this.next();
            var right = this.parseEquality();
            left = {
                type: 'BinaryOp',
                left: left,
                operator: opToken.value,
                right: right,
                loc: {
                    line: left.loc.line,
                    columnStart: left.loc.columnStart,
                    columnEnd: right.loc.columnEnd
                }
            };
        }
        return left;
    };
    BaseParser.prototype.parseEquality = function () {
        var left = this.parseRelational();
        var ops = ['==', '!=', '===', '!=='];
        while (this.match('OPERATOR') && ops.includes(this.peek().value)) {
            var opToken = this.next();
            var right = this.parseRelational();
            left = {
                type: 'BinaryOp',
                left: left,
                operator: opToken.value,
                right: right,
                loc: {
                    line: left.loc.line,
                    columnStart: left.loc.columnStart,
                    columnEnd: right.loc.columnEnd
                }
            };
        }
        return left;
    };
    BaseParser.prototype.parseRelational = function () {
        var left = this.parseAdditive();
        var ops = ['<', '>', '<=', '>='];
        while ((this.match('OPERATOR') && ops.includes(this.peek().value)) ||
            (this.lang === 'python' && this.match('KEYWORD', 'in')) ||
            (this.lang === 'python' && this.match('KEYWORD', 'not') && this.peek(1).type === 'KEYWORD' && this.peek(1).value === 'in') ||
            ((this.lang === 'java' || this.lang === 'javascript') && this.match('KEYWORD', 'instanceof'))) {
            var isNotIn = this.lang === 'python' && this.match('KEYWORD', 'not');
            var isInstanceOf = (this.lang === 'java' || this.lang === 'javascript') && this.match('KEYWORD', 'instanceof');
            var opToken = void 0;
            if (isInstanceOf) {
                opToken = this.next();
            }
            else if (isNotIn) {
                var notToken = this.next();
                var inToken = this.next();
                opToken = {
                    type: 'KEYWORD',
                    value: 'not in',
                    line: notToken.line,
                    col: notToken.col,
                    index: notToken.index
                };
            }
            else {
                opToken = this.next();
            }
            var right = this.parseAdditive();
            left = {
                type: 'BinaryOp',
                left: left,
                operator: opToken.value,
                right: right,
                loc: {
                    line: left.loc.line,
                    columnStart: left.loc.columnStart,
                    columnEnd: right.loc.columnEnd
                }
            };
        }
        return left;
    };
    BaseParser.prototype.parseAdditive = function () {
        var left = this.parseMultiplicative();
        var ops = ['+', '-'];
        while (this.match('OPERATOR') && ops.includes(this.peek().value)) {
            var opToken = this.next();
            var right = this.parseMultiplicative();
            left = {
                type: 'BinaryOp',
                left: left,
                operator: opToken.value,
                right: right,
                loc: {
                    line: left.loc.line,
                    columnStart: left.loc.columnStart,
                    columnEnd: right.loc.columnEnd
                }
            };
        }
        return left;
    };
    BaseParser.prototype.parseMultiplicative = function () {
        var left = this.parseExponentiation();
        var ops = ['*', '/', '%', '//'];
        while (this.match('OPERATOR') && ops.includes(this.peek().value)) {
            var opToken = this.next();
            var right = this.parseExponentiation();
            left = {
                type: 'BinaryOp',
                left: left,
                operator: opToken.value,
                right: right,
                loc: {
                    line: left.loc.line,
                    columnStart: left.loc.columnStart,
                    columnEnd: right.loc.columnEnd
                }
            };
        }
        return left;
    };
    BaseParser.prototype.parseExponentiation = function () {
        var left = this.parseUnary();
        while (this.match('OPERATOR', '**')) {
            var opToken = this.next();
            var right = this.parseUnary();
            left = {
                type: 'BinaryOp',
                left: left,
                operator: '**',
                right: right,
                loc: {
                    line: left.loc.line,
                    columnStart: left.loc.columnStart,
                    columnEnd: right.loc.columnEnd
                }
            };
        }
        return left;
    };
    BaseParser.prototype.parseUnary = function () {
        var typeKeywords = ['int', 'float', 'double', 'char', 'void', 'bool', 'boolean', 'String'];
        if ((this.lang === 'c' || this.lang === 'cpp' || this.lang === 'java') &&
            this.match('PUNCTUATION', '(') &&
            (typeKeywords.includes(this.peek(1).value) || this.peek(1).type === 'IDENTIFIER') &&
            this.peek(2).type === 'PUNCTUATION' && this.peek(2).value === ')') {
            var startToken = this.next(); // consume '('
            var castType = this.next().value; // e.g. 'int'
            this.consume('PUNCTUATION', ')');
            var expr = this.parseUnary();
            if (typeKeywords.includes(castType)) {
                var name_1 = castType;
                if (castType === 'double')
                    name_1 = 'float';
                if (castType === 'bool' || castType === 'boolean')
                    name_1 = 'bool';
                return {
                    type: 'FunctionCall',
                    name: name_1,
                    args: [expr],
                    loc: this.getLoc(startToken)
                };
            }
            return expr;
        }
        if (this.match('OPERATOR') && (this.peek().value === '!' || this.peek().value === '-' || this.peek().value === '&' || this.peek().value === '*' || this.peek().value === '++' || this.peek().value === '--')) {
            var startToken = this.next();
            var expr = this.parseUnary();
            if (startToken.value === '&') {
                if (expr.type !== 'Identifier' && expr.type !== 'MemberAccess' && expr.type !== 'ArrayAccess') {
                    throw new Error("Cannot take address of non-addressable expression at line ".concat(startToken.line));
                }
                return {
                    type: 'AddressOf',
                    targetExpr: expr,
                    targetName: expr.type === 'Identifier' ? expr.name : '',
                    loc: this.getLoc(startToken)
                };
            }
            else if (startToken.value === '*') {
                return {
                    type: 'PointerDeref',
                    pointerExpr: expr,
                    loc: this.getLoc(startToken)
                };
            }
            else if (startToken.value === '++' || startToken.value === '--') {
                return {
                    type: 'BinaryOp',
                    left: expr,
                    operator: startToken.value + '_prefix',
                    right: { type: 'Literal', value: 1, valueType: 'number', loc: this.getLoc(startToken) },
                    loc: this.getLoc(startToken)
                };
            }
            return {
                type: 'BinaryOp',
                left: { type: 'Literal', value: 0, valueType: 'number', loc: this.getLoc(startToken) },
                operator: startToken.value,
                right: expr,
                loc: this.getLoc(startToken)
            };
        }
        if (this.lang === 'python' && this.match('KEYWORD', 'not')) {
            var startToken = this.next();
            var expr = this.parseUnary();
            return {
                type: 'BinaryOp',
                left: { type: 'Literal', value: false, valueType: 'boolean', loc: this.getLoc(startToken) },
                operator: '==',
                right: expr,
                loc: this.getLoc(startToken)
            };
        }
        return this.parsePrimary();
    };
    BaseParser.prototype.parsePrimary = function () {
        var t = this.peek();
        var expr = null;
        if (this.lang === 'python' && t.type === 'KEYWORD' && t.value === 'lambda') {
            var startToken = this.next(); // consume lambda
            var params = [];
            while (!this.match('OPERATOR', ':') && !this.match('EOF')) {
                var paramToken = this.consume('IDENTIFIER');
                params.push({ name: paramToken.value, type: 'any' });
                if (this.match('PUNCTUATION', ','))
                    this.next();
            }
            this.consume('OPERATOR', ':');
            var bodyExpr = this.parseExpression();
            expr = {
                type: 'Lambda',
                params: params,
                body: bodyExpr,
                loc: this.getLoc(startToken)
            };
        }
        else if (this.isArrowFunction()) {
            var startToken = this.peek();
            var params = [];
            if (this.match('PUNCTUATION', '(')) {
                this.next(); // consume '('
                while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
                    var paramToken = this.consume('IDENTIFIER');
                    params.push({ name: paramToken.value, type: 'any' });
                    if (this.match('PUNCTUATION', ','))
                        this.next();
                }
                this.consume('PUNCTUATION', ')');
            }
            else {
                var paramToken = this.consume('IDENTIFIER');
                params.push({ name: paramToken.value, type: 'any' });
            }
            this.next(); // consume => or ->
            var body = void 0;
            if (this.match('PUNCTUATION', '{')) {
                this.next(); // consume '{'
                var bodyStmts = [];
                while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
                    var stmt = this.parseStatement();
                    if (stmt) {
                        if (Array.isArray(stmt))
                            bodyStmts.push.apply(bodyStmts, stmt);
                        else
                            bodyStmts.push(stmt);
                    }
                }
                this.consume('PUNCTUATION', '}');
                body = bodyStmts;
            }
            else {
                body = this.parseExpression();
            }
            expr = {
                type: 'Lambda',
                params: params,
                body: body,
                loc: this.getLoc(startToken)
            };
        }
        else if (t.type === 'NUMBER') {
            var token = this.next();
            var isFloat = token.value.includes('.');
            expr = {
                type: 'Literal',
                value: isFloat ? parseFloat(token.value) : parseInt(token.value, 10),
                valueType: isFloat ? 'float' : 'number',
                loc: this.getLoc(token)
            };
        }
        else if (t.type === 'STRING') {
            var token = this.next();
            expr = {
                type: 'Literal',
                value: token.value,
                valueType: 'string',
                loc: this.getLoc(token)
            };
        }
        else if (t.type === 'KEYWORD' && (t.value === 'true' || t.value === 'false' || t.value === 'True' || t.value === 'False')) {
            var token = this.next();
            expr = {
                type: 'Literal',
                value: token.value.toLowerCase() === 'true',
                valueType: 'boolean',
                loc: this.getLoc(token)
            };
        }
        else if (t.type === 'KEYWORD' && (t.value === 'null' || t.value === 'NULL' || t.value === 'nullptr' || t.value === 'None')) {
            var token = this.next();
            expr = {
                type: 'Literal',
                value: null,
                valueType: 'null',
                loc: this.getLoc(token)
            };
        }
        else if (t.type === 'PUNCTUATION' && t.value === '(') {
            var startToken = this.next();
            if (this.lang === 'python' && this.match('PUNCTUATION', ')')) {
                this.next();
                expr = { type: 'ArrayLiteral', elements: [], loc: this.getLoc(startToken) };
            }
            else {
                var firstExpr = this.parseExpression();
                if (this.lang === 'python' && this.match('PUNCTUATION', ',')) {
                    var elements = [firstExpr];
                    while (this.match('PUNCTUATION', ',')) {
                        this.next(); // consume ','
                        if (this.match('PUNCTUATION', ')'))
                            break;
                        elements.push(this.parseExpression());
                    }
                    this.consume('PUNCTUATION', ')');
                    expr = { type: 'ArrayLiteral', elements: elements, loc: this.getLoc(startToken) };
                }
                else {
                    this.consume('PUNCTUATION', ')');
                    expr = firstExpr;
                }
            }
        }
        else if ((t.type === 'PUNCTUATION' && t.value === '[') || (t.type === 'PUNCTUATION' && t.value === '{' && (this.lang === 'c' || this.lang === 'cpp' || this.lang === 'java'))) {
            var startToken = this.next();
            var closeChar = startToken.value === '[' ? ']' : '}';
            if (this.match('PUNCTUATION', closeChar)) {
                this.next();
                expr = { type: 'ArrayLiteral', elements: [], loc: this.getLoc(startToken) };
            }
            else {
                var firstExpr = this.parseExpression();
                if (this.lang === 'python' && this.match('KEYWORD', 'for')) {
                    this.next(); // consume for
                    var varToken = this.consume('IDENTIFIER');
                    this.consume('KEYWORD', 'in');
                    var iterable = this.parseExpression();
                    this.consume('PUNCTUATION', closeChar);
                    expr = {
                        type: 'ListComprehension',
                        expression: firstExpr,
                        iteratorVar: varToken.value,
                        iterable: iterable,
                        loc: this.getLoc(startToken)
                    };
                }
                else {
                    var elements = [firstExpr];
                    if (this.match('PUNCTUATION', ',')) {
                        this.next();
                    }
                    while (!this.match('PUNCTUATION', closeChar) && !this.match('EOF')) {
                        elements.push(this.parseExpression());
                        if (this.match('PUNCTUATION', ',')) {
                            this.next();
                        }
                    }
                    this.consume('PUNCTUATION', closeChar);
                    expr = {
                        type: 'ArrayLiteral',
                        elements: elements,
                        loc: this.getLoc(startToken)
                    };
                }
            }
        }
        else if (t.type === 'PUNCTUATION' && t.value === '{' && this.lang !== 'c' && this.lang !== 'cpp') {
            var startToken = this.next();
            var isSet = false;
            if (this.lang === 'python') {
                // Python sets: lookahead to see if there is a colon before the next comma or closing brace
                var checkIdx = 0;
                var depth = 1;
                var foundColon = false;
                var isEmpty = true;
                while (this.peek(checkIdx).type !== 'EOF' && depth > 0) {
                    var tok = this.peek(checkIdx);
                    isEmpty = false;
                    if (tok.type === 'PUNCTUATION' && tok.value === '{')
                        depth++;
                    if (tok.type === 'PUNCTUATION' && tok.value === '}')
                        depth--;
                    if (depth === 1 && tok.type === 'OPERATOR' && tok.value === ':') {
                        foundColon = true;
                        break;
                    }
                    if (depth === 1 && tok.type === 'PUNCTUATION' && tok.value === '}') {
                        break;
                    }
                    checkIdx++;
                }
                if (!isEmpty && !foundColon) {
                    isSet = true;
                }
            }
            if (isSet) {
                var elements = [];
                while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
                    elements.push(this.parseExpression());
                    if (this.match('PUNCTUATION', ',')) {
                        this.next();
                    }
                }
                this.consume('PUNCTUATION', '}');
                expr = {
                    type: 'ArrayLiteral',
                    elements: elements,
                    loc: this.getLoc(startToken)
                };
            }
            else {
                var entries = [];
                while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
                    var key = this.parseExpression();
                    this.consume('OPERATOR', ':');
                    var value = this.parseExpression();
                    entries.push({ key: key, value: value });
                    if (this.match('PUNCTUATION', ',')) {
                        this.next();
                    }
                }
                this.consume('PUNCTUATION', '}');
                expr = {
                    type: 'DictionaryLiteral',
                    entries: entries,
                    loc: this.getLoc(startToken)
                };
            }
        }
        else if (t.type === 'KEYWORD' && t.value === 'new') {
            var startToken = this.next();
            var className = '';
            if (this.match('IDENTIFIER') || this.match('KEYWORD')) {
                className += this.next().value;
                while (this.match('PUNCTUATION', '.')) {
                    this.next(); // consume .
                    if (this.match('IDENTIFIER') || this.match('KEYWORD')) {
                        className += '.' + this.next().value;
                    }
                }
            }
            else {
                throw new Error("Expected class name after 'new' at line ".concat(startToken.line));
            }
            if (this.match('PUNCTUATION', '[')) {
                this.next();
                var sizeExpr = this.parseExpression();
                this.consume('PUNCTUATION', ']');
                expr = {
                    type: 'NewInstance',
                    className: className + '[]',
                    args: [sizeExpr],
                    loc: this.getLoc(startToken)
                };
            }
            else {
                if (this.match('OPERATOR', '<')) {
                    this.next();
                    while (!this.match('OPERATOR', '>') && !this.match('EOF')) {
                        this.next();
                    }
                    this.consume('OPERATOR', '>');
                }
                this.consume('PUNCTUATION', '(');
                var args = [];
                while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
                    args.push(this.parseExpression());
                    if (this.match('PUNCTUATION', ',')) {
                        this.next();
                    }
                }
                this.consume('PUNCTUATION', ')');
                expr = {
                    type: 'NewInstance',
                    className: className,
                    args: args,
                    loc: this.getLoc(startToken)
                };
            }
        }
        else {
            var structuralKeywords = [
                'let', 'var', 'const', 'function', 'return', 'if', 'else', 'for', 'while', 'new', 'free',
                'def', 'class', 'struct', 'elif', 'and', 'or', 'not', 'delete', 'in', 'import', 'package',
                'using', 'include', 'from'
            ];
            var isIdentifier = t.type === 'IDENTIFIER' ||
                (t.type === 'KEYWORD' && !structuralKeywords.includes(t.value));
            if (isIdentifier) {
                var token = this.next();
                expr = {
                    type: 'Identifier',
                    name: token.value,
                    loc: this.getLoc(token)
                };
            }
        }
        if (!expr) {
            throw new Error("Unexpected token \"".concat(t.value, "\" of type ").concat(t.type, " at line ").concat(t.line, ", col ").concat(t.col));
        }
        // Handle continuous postfixes: member access `.`, array access `[`, function call `(`, pointer arrow `->`, postfix increment/decrement
        while (true) {
            if (this.match('PUNCTUATION', '(')) {
                this.next();
                var args = [];
                while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
                    var argExpr = this.parseExpression();
                    if (this.lang === 'python' && this.match('KEYWORD', 'for')) {
                        var forToken = this.next(); // consume 'for'
                        var varToken = this.consume('IDENTIFIER');
                        this.consume('KEYWORD', 'in');
                        var iterable = this.parseExpression();
                        args.push({
                            type: 'GeneratorExpression',
                            expression: argExpr,
                            variable: varToken.value,
                            iterable: iterable,
                            loc: this.getLoc(forToken)
                        });
                    }
                    else {
                        args.push(argExpr);
                    }
                    if (this.match('PUNCTUATION', ',')) {
                        this.next();
                    }
                }
                this.consume('PUNCTUATION', ')');
                var objectExpr = void 0;
                var name_2 = 'anonymous';
                if (expr.type === 'MemberAccess') {
                    objectExpr = expr.objectExpr;
                    name_2 = expr.property;
                }
                else if (expr.type === 'Identifier') {
                    name_2 = expr.name;
                }
                else {
                    name_2 = expr.name || expr.property || 'anonymous';
                }
                expr = {
                    type: 'FunctionCall',
                    name: name_2,
                    args: args,
                    objectExpr: objectExpr,
                    loc: {
                        line: expr.loc.line,
                        columnStart: expr.loc.columnStart,
                        columnEnd: this.peek().col
                    }
                };
            }
            else if (this.match('PUNCTUATION', '[')) {
                this.next();
                var indexExpr = this.parseExpression();
                this.consume('PUNCTUATION', ']');
                expr = {
                    type: 'ArrayAccess',
                    arrayExpr: expr,
                    indexExpr: indexExpr,
                    loc: {
                        line: expr.loc.line,
                        columnStart: expr.loc.columnStart,
                        columnEnd: this.peek().col
                    }
                };
            }
            else if (this.match('PUNCTUATION', '.')) {
                this.next();
                var propToken = (this.match('IDENTIFIER') || this.match('KEYWORD')) ? this.next() : null;
                if (!propToken) {
                    throw new Error("Expected property identifier after '.'");
                }
                expr = {
                    type: 'MemberAccess',
                    objectExpr: expr,
                    property: propToken.value,
                    loc: {
                        line: expr.loc.line,
                        columnStart: expr.loc.columnStart,
                        columnEnd: propToken.col + propToken.value.length
                    }
                };
            }
            else if (this.match('OPERATOR', '->')) {
                this.next();
                var propToken = (this.match('IDENTIFIER') || this.match('KEYWORD')) ? this.next() : null;
                if (!propToken) {
                    throw new Error("Expected property identifier after '->'");
                }
                var deref = {
                    type: 'PointerDeref',
                    pointerExpr: expr,
                    loc: expr.loc
                };
                expr = {
                    type: 'MemberAccess',
                    objectExpr: deref,
                    property: propToken.value,
                    loc: {
                        line: expr.loc.line,
                        columnStart: expr.loc.columnStart,
                        columnEnd: propToken.col + propToken.value.length
                    }
                };
            }
            else if (this.match('OPERATOR', '++') || this.match('OPERATOR', '--')) {
                var opToken = this.next();
                expr = {
                    type: 'BinaryOp',
                    left: expr,
                    operator: opToken.value + '_postfix',
                    right: { type: 'Literal', value: 1, valueType: 'number', loc: this.getLoc(opToken) },
                    loc: {
                        line: expr.loc.line,
                        columnStart: expr.loc.columnStart,
                        columnEnd: opToken.col + opToken.value.length
                    }
                };
            }
            else {
                break;
            }
        }
        return expr;
    };
    return BaseParser;
}());
exports.BaseParser = BaseParser;
