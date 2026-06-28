"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PythonParser = void 0;
var parser_1 = require("../parser");
var PythonParser = /** @class */ (function (_super) {
    __extends(PythonParser, _super);
    function PythonParser(code) {
        var _this = _super.call(this, code, 'python') || this;
        _this.currentClassName = null;
        return _this;
    }
    PythonParser.prototype.parse = function () {
        var statements = [];
        while (!this.match('EOF')) {
            try {
                var stmt = this.parseStatement();
                if (stmt)
                    statements.push(stmt);
            }
            catch (err) {
                throw err;
            }
        }
        return statements;
    };
    PythonParser.prototype.parseStatement = function () {
        var _a;
        var t = this.peek();
        // Skip standalone newlines or semicolons
        if (t.type === 'NEWLINE' || (t.type === 'PUNCTUATION' && t.value === ';')) {
            this.next();
            return null;
        }
        // Decorator: @decorator_name\n def ...
        if (t.type === 'OPERATOR' && t.value === '@') {
            this.next(); // consume @
            // consume decorator name (could be identifier chain like @staticmethod or @property.setter)
            while (this.match('IDENTIFIER') || (this.peek().type === 'PUNCTUATION' && this.peek().value === '.')) {
                this.next();
            }
            // consume optional parentheses: @decorator(args)
            if (this.match('PUNCTUATION', '(')) {
                this.next();
                var depth = 1;
                while (depth > 0 && !this.match('EOF')) {
                    if (this.match('PUNCTUATION', '('))
                        depth++;
                    else if (this.match('PUNCTUATION', ')'))
                        depth--;
                    this.next();
                }
            }
            if (this.match('NEWLINE'))
                this.next();
            return null; // decorator itself is not a statement — next statement is the actual def
        }
        // Function definition: def name(p1, *args, **kwargs):
        if (t.type === 'KEYWORD' && t.value === 'def') {
            var startToken = this.next();
            var nameToken = this.consume('IDENTIFIER');
            var funcName = nameToken.value;
            if (this.currentClassName) {
                funcName = this.currentClassName + '.' + funcName;
            }
            this.consume('PUNCTUATION', '(');
            var params = [];
            while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
                // Handle *args and **kwargs
                if (this.match('OPERATOR', '**')) {
                    this.next(); // consume **
                    var pName = this.consume('IDENTIFIER');
                    params.push({ name: '**' + pName.value, type: 'any' });
                }
                else if (this.match('OPERATOR', '*')) {
                    this.next(); // consume *
                    if (this.match('IDENTIFIER')) {
                        var pName = this.next();
                        params.push({ name: '*' + pName.value, type: 'any' });
                    }
                }
                else {
                    var pName = this.consume('IDENTIFIER');
                    // Handle default value: param=default
                    if (this.match('OPERATOR', '=')) {
                        this.next();
                        this.parseExpression(); // consume default, discard
                    }
                    // Handle type annotation: param: Type
                    if (this.match('OPERATOR', ':')) {
                        this.next();
                        this.parseExpression(); // consume type hint, discard
                    }
                    params.push({ name: pName.value, type: 'any' });
                }
                if (this.match('PUNCTUATION', ','))
                    this.next();
            }
            this.consume('PUNCTUATION', ')');
            // Handle return type annotation: -> Type
            if (this.match('OPERATOR', '->')) {
                this.next();
                this.parseExpression(); // consume type hint, discard
            }
            this.consume('OPERATOR', ':');
            this.consume('NEWLINE');
            this.consume('INDENT');
            var body = this.parseBlock();
            return {
                type: 'FunctionDeclaration',
                name: funcName,
                params: params,
                returnType: 'any',
                body: body,
                loc: this.getLoc(startToken)
            };
        }
        // Return statement: return expr
        if (t.type === 'KEYWORD' && t.value === 'return') {
            var startToken = this.next();
            var valueExpr = void 0;
            if (!this.match('NEWLINE') && !this.match('EOF')) {
                valueExpr = this.parseExpression();
            }
            if (this.match('NEWLINE'))
                this.next();
            return {
                type: 'ReturnStatement',
                valueExpr: valueExpr,
                loc: this.getLoc(startToken)
            };
        }
        // Pass statement
        if (t.type === 'KEYWORD' && t.value === 'pass') {
            var startToken = this.next();
            if (this.match('NEWLINE'))
                this.next();
            return {
                type: 'ExpressionStatement',
                expr: { type: 'Literal', value: null, valueType: 'null', loc: this.getLoc(startToken) },
                loc: this.getLoc(startToken)
            };
        }
        // Yield statement (inside generator)
        if (t.type === 'KEYWORD' && t.value === 'yield') {
            var startToken = this.next();
            var valueExpr = void 0;
            if (!this.match('NEWLINE') && !this.match('EOF')) {
                valueExpr = this.parseExpression();
            }
            if (this.match('NEWLINE'))
                this.next();
            return {
                type: 'ReturnStatement', // treat yield as return for our purposes
                valueExpr: valueExpr,
                loc: this.getLoc(startToken)
            };
        }
        // With statement: with expr as var:
        if (t.type === 'KEYWORD' && t.value === 'with') {
            var startToken = this.next();
            var ctxExpr = this.parseExpression(); // e.g. open('file', 'r')
            var asVar = void 0;
            if (this.match('KEYWORD', 'as')) {
                this.next();
                asVar = this.consume('IDENTIFIER').value;
            }
            this.consume('OPERATOR', ':');
            this.consume('NEWLINE');
            this.consume('INDENT');
            var body = this.parseBlock();
            // Wrap: assign ctxExpr result to asVar, then execute body
            var stmts = [];
            if (asVar) {
                stmts.push({
                    type: 'VarDeclaration',
                    name: asVar,
                    varType: 'any',
                    valueExpr: ctxExpr,
                    loc: this.getLoc(startToken)
                });
            }
            stmts.push.apply(stmts, body);
            return { type: 'TryStatement', tryBody: stmts, exceptBody: [], finallyBody: [], loc: this.getLoc(startToken) };
        }
        // Break statement: break
        if (t.type === 'KEYWORD' && t.value === 'break') {
            var startToken = this.next();
            if (this.match('NEWLINE'))
                this.next();
            return { type: 'BreakStatement', loc: this.getLoc(startToken) };
        }
        // Continue statement: continue
        if (t.type === 'KEYWORD' && t.value === 'continue') {
            var startToken = this.next();
            if (this.match('NEWLINE'))
                this.next();
            return { type: 'ContinueStatement', loc: this.getLoc(startToken) };
        }
        // Raise statement: raise ExceptionExpr
        if (t.type === 'KEYWORD' && t.value === 'raise') {
            var startToken = this.next();
            var expr_1 = this.parseExpression();
            if (this.match('NEWLINE'))
                this.next();
            return { type: 'ThrowStatement', expr: expr_1, loc: this.getLoc(startToken) };
        }
        // Try-Except statement: try: ... except [Exception]: ...
        if (t.type === 'KEYWORD' && t.value === 'try') {
            var startToken = this.next();
            this.consume('OPERATOR', ':');
            this.consume('NEWLINE');
            this.consume('INDENT');
            var tryBody = this.parseBlock();
            var exceptBody = [];
            var errorVar = void 0;
            var nextT = this.peek();
            if (nextT.type === 'KEYWORD' && nextT.value === 'except') {
                this.next(); // consume except
                if (this.match('IDENTIFIER')) {
                    errorVar = this.next().value;
                }
                this.consume('OPERATOR', ':');
                this.consume('NEWLINE');
                this.consume('INDENT');
                exceptBody = this.parseBlock();
            }
            var finallyBody = void 0;
            if (this.peek().type === 'KEYWORD' && this.peek().value === 'finally') {
                this.next();
                this.consume('OPERATOR', ':');
                this.consume('NEWLINE');
                this.consume('INDENT');
                finallyBody = this.parseBlock();
            }
            return {
                type: 'TryStatement',
                tryBody: tryBody,
                exceptBody: exceptBody,
                errorVar: errorVar,
                finallyBody: finallyBody,
                loc: this.getLoc(startToken)
            };
        }
        // Class definition: class ClassName(BaseClassName):
        if (t.type === 'KEYWORD' && t.value === 'class') {
            var startToken = this.next();
            var className = this.consume('IDENTIFIER');
            var baseClass = void 0;
            if (this.match('PUNCTUATION', '(')) {
                this.next(); // consume '('
                if (this.match('IDENTIFIER')) {
                    baseClass = this.next().value;
                    while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
                        this.next();
                    }
                }
                this.consume('PUNCTUATION', ')');
            }
            this.consume('OPERATOR', ':');
            this.consume('NEWLINE');
            var prevClass = this.currentClassName;
            this.currentClassName = className.value;
            this.consume('INDENT');
            var body = this.parseBlock();
            this.currentClassName = prevClass;
            return {
                type: 'FunctionDeclaration',
                name: className.value + '.class_init',
                params: [],
                returnType: 'void',
                body: body,
                baseClass: baseClass || undefined,
                loc: this.getLoc(startToken)
            };
        }
        // Conditional: if cond: ... elif cond: ... else: ...
        if (t.type === 'KEYWORD' && (t.value === 'if' || t.value === 'elif')) {
            var startToken = this.next();
            var condition = this.parseExpression();
            this.consume('OPERATOR', ':');
            var thenBody = [];
            if (this.match('NEWLINE')) {
                this.next();
                this.consume('INDENT');
                thenBody = this.parseBlock();
            }
            else {
                var stmt = this.parseStatement();
                if (stmt)
                    thenBody.push(stmt);
            }
            var elseIfs = [];
            var elseBody = void 0;
            while (this.peek().type === 'KEYWORD' && this.peek().value === 'elif') {
                this.next(); // consume elif
                var elifCondition = this.parseExpression();
                this.consume('OPERATOR', ':');
                var elifBody = [];
                if (this.match('NEWLINE')) {
                    this.next();
                    this.consume('INDENT');
                    elifBody = this.parseBlock();
                }
                else {
                    var stmt = this.parseStatement();
                    if (stmt)
                        elifBody.push(stmt);
                }
                elseIfs.push({ condition: elifCondition, body: elifBody });
            }
            if (this.peek().type === 'KEYWORD' && this.peek().value === 'else') {
                this.next(); // consume else
                this.consume('OPERATOR', ':');
                if (this.match('NEWLINE')) {
                    this.next();
                    this.consume('INDENT');
                    elseBody = this.parseBlock();
                }
                else {
                    elseBody = [];
                    var stmt = this.parseStatement();
                    if (stmt)
                        elseBody.push(stmt);
                }
            }
            return {
                type: 'Conditional',
                condition: condition,
                thenBody: thenBody,
                elseIfs: elseIfs.length > 0 ? elseIfs : undefined,
                elseBody: elseBody,
                loc: this.getLoc(startToken)
            };
        }
        // Loop: while cond:
        if (t.type === 'KEYWORD' && t.value === 'while') {
            var startToken = this.next();
            var condition = this.parseExpression();
            this.consume('OPERATOR', ':');
            this.consume('NEWLINE');
            this.consume('INDENT');
            var body = this.parseBlock();
            return {
                type: 'Loop',
                loopType: 'while',
                condition: condition,
                body: body,
                loc: this.getLoc(startToken)
            };
        }
        // Loop: for i in range(10):
        // Or: for k, v in d.items():
        if (t.type === 'KEYWORD' && t.value === 'for') {
            var startToken = this.next();
            var loopVars = [];
            loopVars.push(this.consume('IDENTIFIER').value);
            while (this.match('PUNCTUATION', ',')) {
                this.next(); // consume ','
                loopVars.push(this.consume('IDENTIFIER').value);
            }
            this.consume('KEYWORD', 'in');
            var iterableExpr = this.parseExpression();
            this.consume('OPERATOR', ':');
            this.consume('NEWLINE');
            this.consume('INDENT');
            var body = this.parseBlock();
            return {
                type: 'Loop',
                loopType: 'for-range',
                iteratorVar: loopVars.join(','),
                iterable: iterableExpr,
                body: body,
                loc: this.getLoc(startToken)
            };
        }
        // Output check: print(exprs)
        if ((t.type === 'KEYWORD' || t.type === 'IDENTIFIER') && t.value === 'print') {
            var startToken = this.next();
            this.consume('PUNCTUATION', '(');
            var exprs = [];
            while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
                exprs.push(this.parseExpression());
                if (this.match('PUNCTUATION', ','))
                    this.next();
            }
            this.consume('PUNCTUATION', ')');
            if (this.match('NEWLINE'))
                this.next();
            return {
                type: 'Output',
                exprs: exprs,
                appendNewline: true,
                loc: this.getLoc(startToken)
            };
        }
        // General expression or assignment statement
        var expr = this.parseExpression();
        if (this.match('PUNCTUATION', ';'))
            this.next();
        if (this.match('NEWLINE'))
            this.next();
        // Check if it matches an input statement: x = input("prompt") or x = int(input())
        if (expr.type === 'BinaryOp' && expr.operator === '=') {
            var isInput = false;
            var promptMsg = '';
            var expectedType = 'string';
            var rhs = expr.right;
            if (rhs.type === 'FunctionCall' && rhs.name === 'input') {
                isInput = true;
                var arg = rhs.args[0];
                if (arg && arg.type === 'Literal')
                    promptMsg = String(arg.value);
            }
            else if (rhs.type === 'FunctionCall' &&
                (rhs.name === 'int' || rhs.name === 'float') &&
                ((_a = rhs.args[0]) === null || _a === void 0 ? void 0 : _a.type) === 'FunctionCall' &&
                rhs.args[0].name === 'input') {
                isInput = true;
                expectedType = rhs.name === 'int' ? 'integer' : 'float';
                var arg = rhs.args[0].args[0];
                if (arg && arg.type === 'Literal')
                    promptMsg = String(arg.value);
            }
            if (isInput) {
                return {
                    type: 'Input',
                    prompt: promptMsg,
                    target: expr.left,
                    expectedType: expectedType,
                    loc: expr.loc
                };
            }
        }
        // In Python, standard identifiers without keywords can act as declarations or assignments
        if (expr.type === 'BinaryOp' && expr.operator === '=' && expr.left.type === 'Identifier') {
            // Treat first assignment as VarDeclaration + Assignment Visualizer mapping
            return {
                type: 'VarDeclaration',
                name: expr.left.name,
                varType: 'any',
                valueExpr: expr.right,
                loc: expr.loc
            };
        }
        return {
            type: 'ExpressionStatement',
            expr: expr,
            loc: expr.loc
        };
    };
    PythonParser.prototype.parseBlock = function () {
        var body = [];
        while (!this.match('DEDENT') && !this.match('EOF')) {
            var stmt = this.parseStatement();
            if (stmt)
                body.push(stmt);
        }
        this.consume('DEDENT');
        return body;
    };
    return PythonParser;
}(parser_1.BaseParser));
exports.PythonParser = PythonParser;
