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
exports.JSParser = void 0;
var parser_1 = require("../parser");
var JSParser = /** @class */ (function (_super) {
    __extends(JSParser, _super);
    function JSParser(code) {
        var _this = _super.call(this, code, 'javascript') || this;
        _this.currentClassName = null;
        return _this;
    }
    JSParser.prototype.parse = function () {
        var statements = [];
        while (!this.match('EOF')) {
            try {
                var stmt = this.parseStatement();
                if (stmt)
                    statements.push(stmt);
            }
            catch (err) {
                // Fallback or throw
                throw err;
            }
        }
        return statements;
    };
    JSParser.prototype.parseStatement = function () {
        var t = this.peek();
        if (t.type === 'PUNCTUATION' && t.value === ';') {
            this.next();
            return null;
        }
        // Class definition: class ClassName { constructor(...) { ... } method() { ... } }
        if (t.type === 'KEYWORD' && t.value === 'class') {
            var startToken = this.next();
            var className = this.consume('IDENTIFIER');
            var baseClass = void 0;
            if (this.match('KEYWORD', 'extends')) {
                this.next(); // consume extends
                baseClass = this.consume('IDENTIFIER').value; // consume base class
            }
            this.consume('PUNCTUATION', '{');
            var prevClass = this.currentClassName;
            this.currentClassName = className.value;
            var body = [];
            while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
                var memberToken = this.peek();
                // Skip standalone semicolons
                if (memberToken.type === 'PUNCTUATION' && memberToken.value === ';') {
                    this.next();
                    continue;
                }
                // Method or constructor
                var isConstructor = false;
                var name_1 = '';
                if (memberToken.type === 'IDENTIFIER') {
                    name_1 = this.next().value;
                    if (name_1 === 'constructor') {
                        isConstructor = true;
                    }
                }
                else if (memberToken.type === 'KEYWORD' && memberToken.value === 'constructor') {
                    this.next();
                    name_1 = 'constructor';
                    isConstructor = true;
                }
                else {
                    // If unexpected token, let parseStatement handle it or throw
                    throw new Error("Unexpected token \"".concat(memberToken.value, "\" in class body"));
                }
                this.consume('PUNCTUATION', '(');
                var params = [];
                // Prepend 'this' parameter for method / constructor
                params.push({ name: 'this', type: 'any' });
                while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
                    var pName = this.consume('IDENTIFIER');
                    params.push({ name: pName.value, type: 'any' });
                    if (this.match('PUNCTUATION', ','))
                        this.next();
                }
                this.consume('PUNCTUATION', ')');
                this.consume('PUNCTUATION', '{');
                var methodBody = this.parseBlock();
                body.push({
                    type: 'FunctionDeclaration',
                    name: isConstructor ? (className.value + '.__init__') : (className.value + '.' + name_1),
                    params: params,
                    returnType: 'any',
                    body: methodBody,
                    loc: this.getLoc(memberToken)
                });
            }
            this.consume('PUNCTUATION', '}');
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
        // Variable declaration: let, const, var
        if (t.type === 'KEYWORD' && (t.value === 'let' || t.value === 'const' || t.value === 'var')) {
            var startToken = this.next();
            var nameToken = this.consume('IDENTIFIER');
            var valueExpr = void 0;
            if (this.match('OPERATOR', '=')) {
                this.next();
                valueExpr = this.parseExpression();
            }
            if (this.match('PUNCTUATION', ';'))
                this.next();
            return {
                type: 'VarDeclaration',
                name: nameToken.value,
                varType: startToken.value,
                valueExpr: valueExpr,
                loc: this.getLoc(startToken)
            };
        }
        // Function declaration: function name(params) { body }
        if (t.type === 'KEYWORD' && t.value === 'function') {
            var startToken = this.next();
            var nameToken = this.consume('IDENTIFIER');
            this.consume('PUNCTUATION', '(');
            var params = [];
            while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
                var pName = this.consume('IDENTIFIER');
                params.push({ name: pName.value, type: 'any' });
                if (this.match('PUNCTUATION', ','))
                    this.next();
            }
            this.consume('PUNCTUATION', ')');
            this.consume('PUNCTUATION', '{');
            var body = this.parseBlock();
            return {
                type: 'FunctionDeclaration',
                name: nameToken.value,
                params: params,
                returnType: 'any',
                body: body,
                loc: this.getLoc(startToken)
            };
        }
        // Return statement: return expr;
        if (t.type === 'KEYWORD' && t.value === 'return') {
            var startToken = this.next();
            var valueExpr = void 0;
            if (!this.match('PUNCTUATION', ';') && !this.match('EOF')) {
                valueExpr = this.parseExpression();
            }
            if (this.match('PUNCTUATION', ';'))
                this.next();
            return {
                type: 'ReturnStatement',
                valueExpr: valueExpr,
                loc: this.getLoc(startToken)
            };
        }
        // Break statement: break
        if (t.type === 'KEYWORD' && t.value === 'break') {
            var startToken = this.next();
            if (this.match('PUNCTUATION', ';'))
                this.next();
            return { type: 'BreakStatement', loc: this.getLoc(startToken) };
        }
        // Continue statement: continue
        if (t.type === 'KEYWORD' && t.value === 'continue') {
            var startToken = this.next();
            if (this.match('PUNCTUATION', ';'))
                this.next();
            return { type: 'ContinueStatement', loc: this.getLoc(startToken) };
        }
        // Throw statement: throw expr;
        if (t.type === 'KEYWORD' && t.value === 'throw') {
            var startToken = this.next();
            var expr_1 = this.parseExpression();
            if (this.match('PUNCTUATION', ';'))
                this.next();
            return { type: 'ThrowStatement', expr: expr_1, loc: this.getLoc(startToken) };
        }
        // Try/catch/finally
        if (t.type === 'KEYWORD' && t.value === 'try') {
            var startToken = this.next();
            this.consume('PUNCTUATION', '{');
            var tryBody = this.parseBlock();
            var exceptBody = [];
            var errorVar = void 0;
            var finallyBody = void 0;
            if (this.match('KEYWORD', 'catch')) {
                this.next();
                if (this.match('PUNCTUATION', '(')) {
                    this.next();
                    if (this.match('IDENTIFIER'))
                        errorVar = this.next().value;
                    if (this.match('PUNCTUATION', ')'))
                        this.next();
                }
                this.consume('PUNCTUATION', '{');
                exceptBody = this.parseBlock();
            }
            if (this.match('KEYWORD', 'finally')) {
                this.next();
                this.consume('PUNCTUATION', '{');
                finallyBody = this.parseBlock();
            }
            return { type: 'TryStatement', tryBody: tryBody, exceptBody: exceptBody, errorVar: errorVar, finallyBody: finallyBody, loc: this.getLoc(startToken) };
        }
        // Switch statement: switch (expr) { case x: ... default: ... }
        if (t.type === 'KEYWORD' && t.value === 'switch') {
            var startToken = this.next();
            this.consume('PUNCTUATION', '(');
            var discriminant = this.parseExpression();
            this.consume('PUNCTUATION', ')');
            this.consume('PUNCTUATION', '{');
            var cases = [];
            while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
                if (this.match('KEYWORD', 'case')) {
                    this.next();
                    var caseVal = this.parseExpression();
                    this.consume('OPERATOR', ':');
                    var body = [];
                    while (!this.match('KEYWORD', 'case') && !this.match('KEYWORD', 'default') && !this.match('PUNCTUATION', '}') && !this.match('EOF')) {
                        var s = this.parseStatement();
                        if (s)
                            body.push(s);
                    }
                    cases.push({ value: caseVal, body: body });
                }
                else if (this.match('KEYWORD', 'default')) {
                    this.next();
                    this.consume('OPERATOR', ':');
                    var body = [];
                    while (!this.match('KEYWORD', 'case') && !this.match('KEYWORD', 'default') && !this.match('PUNCTUATION', '}') && !this.match('EOF')) {
                        var s = this.parseStatement();
                        if (s)
                            body.push(s);
                    }
                    cases.push({ value: null, body: body });
                }
                else {
                    this.next();
                }
            }
            this.consume('PUNCTUATION', '}');
            return { type: 'SwitchStatement', discriminant: discriminant, cases: cases, loc: this.getLoc(startToken) };
        }
        // Conditional: if (cond) { body } else { body }
        if (t.type === 'KEYWORD' && t.value === 'if') {
            var startToken = this.next();
            this.consume('PUNCTUATION', '(');
            var condition = this.parseExpression();
            this.consume('PUNCTUATION', ')');
            var thenBody = [];
            if (this.match('PUNCTUATION', '{')) {
                this.next();
                thenBody = this.parseBlock();
            }
            else {
                var singleStmt = this.parseStatement();
                if (singleStmt)
                    thenBody.push(singleStmt);
            }
            var elseIfs = [];
            var elseBody = void 0;
            while (this.match('KEYWORD', 'else') && this.peek(1).type === 'KEYWORD' && this.peek(1).value === 'if') {
                this.next(); // consume else
                this.next(); // consume if
                this.consume('PUNCTUATION', '(');
                var elifCondition = this.parseExpression();
                this.consume('PUNCTUATION', ')');
                var elifBody = [];
                if (this.match('PUNCTUATION', '{')) {
                    this.next();
                    elifBody = this.parseBlock();
                }
                else {
                    var singleStmt = this.parseStatement();
                    if (singleStmt)
                        elifBody.push(singleStmt);
                }
                elseIfs.push({ condition: elifCondition, body: elifBody });
            }
            if (this.match('KEYWORD', 'else')) {
                this.next();
                elseBody = [];
                if (this.match('PUNCTUATION', '{')) {
                    this.next();
                    elseBody = this.parseBlock();
                }
                else {
                    var singleStmt = this.parseStatement();
                    if (singleStmt)
                        elseBody.push(singleStmt);
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
        // Loop: while (cond) { body }
        if (t.type === 'KEYWORD' && t.value === 'while') {
            var startToken = this.next();
            this.consume('PUNCTUATION', '(');
            var condition = this.parseExpression();
            this.consume('PUNCTUATION', ')');
            var body = [];
            if (this.match('PUNCTUATION', '{')) {
                this.next();
                body = this.parseBlock();
            }
            else {
                var singleStmt = this.parseStatement();
                if (singleStmt)
                    body.push(singleStmt);
            }
            return {
                type: 'Loop',
                loopType: 'while',
                condition: condition,
                body: body,
                loc: this.getLoc(startToken)
            };
        }
        // Loop: for (let i = 0; i < n; i++) { body }
        if (t.type === 'KEYWORD' && t.value === 'for') {
            var startToken = this.next();
            this.consume('PUNCTUATION', '(');
            var init = void 0;
            if (!this.match('PUNCTUATION', ';')) {
                // Can be declaration or expression
                var isDecl = this.match('KEYWORD', 'let') || this.match('KEYWORD', 'var') || this.match('KEYWORD', 'const');
                if (isDecl) {
                    var dToken = this.next();
                    var nameToken = this.consume('IDENTIFIER');
                    if ((this.peek().type === 'KEYWORD' || this.peek().type === 'IDENTIFIER') && (this.peek().value === 'of' || this.peek().value === 'in')) {
                        this.next(); // consume of/in
                        var iterable = this.parseExpression();
                        this.consume('PUNCTUATION', ')');
                        var body_1 = [];
                        if (this.match('PUNCTUATION', '{')) {
                            this.next();
                            body_1 = this.parseBlock();
                        }
                        else {
                            var singleStmt = this.parseStatement();
                            if (singleStmt)
                                body_1.push(singleStmt);
                        }
                        return {
                            type: 'Loop',
                            loopType: 'for-range',
                            iteratorVar: nameToken.value,
                            iterable: iterable,
                            body: body_1,
                            loc: this.getLoc(startToken)
                        };
                    }
                    this.consume('OPERATOR', '=');
                    var valExpr = this.parseExpression();
                    init = {
                        type: 'VarDeclaration',
                        name: nameToken.value,
                        varType: dToken.value,
                        valueExpr: valExpr,
                        loc: this.getLoc(dToken)
                    };
                }
                else {
                    var expr_2 = this.parseExpression();
                    init = {
                        type: 'ExpressionStatement',
                        expr: expr_2,
                        loc: expr_2.loc
                    };
                }
            }
            this.consume('PUNCTUATION', ';');
            var condition = this.parseExpression();
            this.consume('PUNCTUATION', ';');
            var update = void 0;
            if (!this.match('PUNCTUATION', ')')) {
                var expr_3 = this.parseExpression();
                update = {
                    type: 'ExpressionStatement',
                    expr: expr_3,
                    loc: expr_3.loc
                };
            }
            this.consume('PUNCTUATION', ')');
            var body = [];
            if (this.match('PUNCTUATION', '{')) {
                this.next();
                body = this.parseBlock();
            }
            else {
                var singleStmt = this.parseStatement();
                if (singleStmt)
                    body.push(singleStmt);
            }
            return {
                type: 'Loop',
                loopType: 'for',
                init: init,
                condition: condition,
                update: update,
                body: body,
                loc: this.getLoc(startToken)
            };
        }
        // Output check: console.log(args)
        if (t.type === 'IDENTIFIER' && t.value === 'console' && this.peek(1).value === '.') {
            var startToken = this.next(); // console
            this.consume('PUNCTUATION', '.');
            this.consume('IDENTIFIER', 'log');
            this.consume('PUNCTUATION', '(');
            var exprs = [];
            while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
                exprs.push(this.parseExpression());
                if (this.match('PUNCTUATION', ','))
                    this.next();
            }
            this.consume('PUNCTUATION', ')');
            if (this.match('PUNCTUATION', ';'))
                this.next();
            return {
                type: 'Output',
                exprs: exprs,
                appendNewline: true,
                loc: this.getLoc(startToken)
            };
        }
        // Let's check prompt() function which parses as an input statement
        if (t.type === 'IDENTIFIER' && t.value === 'prompt') {
            var startToken = this.next();
            this.consume('PUNCTUATION', '(');
            var promptMsg = 'Enter value: ';
            if (this.match('STRING')) {
                promptMsg = this.next().value;
            }
            this.consume('PUNCTUATION', ')');
            if (this.match('PUNCTUATION', ';'))
                this.next();
            return {
                type: 'Input',
                prompt: promptMsg,
                target: { type: 'Identifier', name: 'tempInput', loc: this.getLoc(startToken) },
                expectedType: 'string',
                loc: this.getLoc(startToken)
            };
        }
        // General expression statement (e.g. assignments, function calls)
        var expr = this.parseExpression();
        if (this.match('PUNCTUATION', ';'))
            this.next();
        // Check if expression is assignment or input prompt (e.g., let x = prompt())
        if (expr.type === 'BinaryOp' && expr.operator === '=' && expr.right.type === 'FunctionCall' && expr.right.name === 'prompt') {
            var promptArg = expr.right.args[0];
            var promptMsg = promptArg && promptArg.type === 'Literal' ? String(promptArg.value) : 'Enter value:';
            return {
                type: 'Input',
                prompt: promptMsg,
                target: expr.left,
                expectedType: 'string',
                loc: expr.loc
            };
        }
        return {
            type: 'ExpressionStatement',
            expr: expr,
            loc: expr.loc
        };
    };
    JSParser.prototype.parseBlock = function () {
        var body = [];
        while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
            var stmt = this.parseStatement();
            if (stmt)
                body.push(stmt);
        }
        this.consume('PUNCTUATION', '}');
        return body;
    };
    return JSParser;
}(parser_1.BaseParser));
exports.JSParser = JSParser;
