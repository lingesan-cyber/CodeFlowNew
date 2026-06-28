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
exports.CParser = void 0;
var parser_1 = require("../parser");
var CParser = /** @class */ (function (_super) {
    __extends(CParser, _super);
    function CParser(code) {
        return _super.call(this, code, 'c') || this;
    }
    CParser.prototype.parse = function () {
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
    CParser.prototype.parseStatement = function () {
        var t = this.peek();
        // Skip optional modifiers like const, static, volatile
        while (t.type === 'KEYWORD' && (t.value === 'const' || t.value === 'static' || t.value === 'volatile')) {
            this.next();
            t = this.peek();
        }
        if (t.type === 'PUNCTUATION' && t.value === ';') {
            this.next();
            return null;
        }
        // Skip includes and macros: #include <stdio.h>, #define MAX 10
        if (t.type === 'OPERATOR' && t.value === '#') {
            while (!this.match('NEWLINE') && !this.match('EOF')) {
                this.next();
            }
            return null;
        }
        // Function/Method or variable declaration
        // C variable declarations start with type keywords: int, float, char, double, void, struct
        var typeKeywords = ['int', 'float', 'char', 'double', 'void', 'struct', 'bool'];
        // We can also have pointers: int *p
        var isType = typeKeywords.includes(t.value) || (t.type === 'IDENTIFIER' && this.peek(1).type === 'OPERATOR' && this.peek(1).value === '*');
        if (isType) {
            var startToken = this.next(); // e.g. int or struct
            var varType = startToken.value;
            // Handle struct syntax e.g. struct Node
            if (startToken.value === 'struct' && this.match('IDENTIFIER')) {
                var structName = this.next();
                varType += ' ' + structName.value;
                // Is it a struct definition: struct Node { ... };
                if (this.match('PUNCTUATION', '{')) {
                    this.next();
                    // Skip struct fields or parse them if needed
                    while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
                        this.next();
                    }
                    this.consume('PUNCTUATION', '}');
                    this.consume('PUNCTUATION', ';');
                    return null;
                }
            }
            // Check pointers: count *
            while (this.match('OPERATOR', '*')) {
                this.next();
                varType += '*';
            }
            var nameToken = this.consume('IDENTIFIER');
            // Check if it's a function declaration e.g. void swap(...) { ... }
            if (this.match('PUNCTUATION', '(')) {
                this.next(); // consume (
                var params = [];
                while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
                    var pTypeToken = this.next();
                    var pType = pTypeToken.value;
                    if (pType === 'struct') {
                        pType += ' ' + this.consume('IDENTIFIER').value;
                    }
                    while (this.match('OPERATOR', '*')) {
                        this.next();
                        pType += '*';
                    }
                    var pName = this.consume('IDENTIFIER');
                    params.push({ name: pName.value, type: pType });
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
                    returnType: varType,
                    body: body,
                    loc: this.getLoc(startToken)
                };
            }
            // Regular variable declaration e.g. int x = 10;
            while (this.match('PUNCTUATION', '[')) {
                this.next(); // consume [
                if (!this.match('PUNCTUATION', ']')) {
                    this.parseExpression();
                }
                this.consume('PUNCTUATION', ']');
                varType += '[]';
            }
            var valueExpr = void 0;
            if (this.match('OPERATOR', '=')) {
                this.next();
                valueExpr = this.parseExpression();
            }
            this.consume('PUNCTUATION', ';');
            return {
                type: 'VarDeclaration',
                name: nameToken.value,
                varType: varType,
                valueExpr: valueExpr,
                loc: this.getLoc(startToken)
            };
        }
        // Return
        if (t.type === 'KEYWORD' && t.value === 'return') {
            var startToken = this.next();
            var valueExpr = void 0;
            if (!this.match('PUNCTUATION', ';') && !this.match('EOF')) {
                valueExpr = this.parseExpression();
            }
            this.consume('PUNCTUATION', ';');
            return {
                type: 'ReturnStatement',
                valueExpr: valueExpr,
                loc: this.getLoc(startToken)
            };
        }
        // Break statement
        if (t.type === 'KEYWORD' && t.value === 'break') {
            var startToken = this.next();
            this.consume('PUNCTUATION', ';');
            return {
                type: 'BreakStatement',
                loc: this.getLoc(startToken)
            };
        }
        // Continue statement
        if (t.type === 'KEYWORD' && t.value === 'continue') {
            var startToken = this.next();
            if (this.match('PUNCTUATION', ';'))
                this.next();
            return { type: 'ContinueStatement', loc: this.getLoc(startToken) };
        }
        // Throw statement
        if (t.type === 'KEYWORD' && (t.value === 'throw' || t.value === 'throws')) {
            var startToken = this.next();
            if (this.match('KEYWORD', 'new')) {
                this.next();
            }
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
                    while (!this.match('IDENTIFIER') && !this.match('PUNCTUATION', ')') && !this.match('EOF'))
                        this.next();
                    if (this.match('IDENTIFIER'))
                        errorVar = this.next().value;
                    while (!this.match('PUNCTUATION', ')') && !this.match('EOF'))
                        this.next();
                    this.consume('PUNCTUATION', ')');
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
        // Switch statement
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
        // Free memory allocation: free(p)
        if (t.type === 'KEYWORD' && t.value === 'free') {
            var startToken = this.next();
            this.consume('PUNCTUATION', '(');
            var expr_2 = this.parseExpression();
            this.consume('PUNCTUATION', ')');
            this.consume('PUNCTUATION', ';');
            return {
                type: 'Free',
                expr: expr_2,
                loc: this.getLoc(startToken)
            };
        }
        // Conditionals
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
        // Loops
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
        if (t.type === 'KEYWORD' && t.value === 'for') {
            var startToken = this.next();
            this.consume('PUNCTUATION', '(');
            var init = void 0;
            if (!this.match('PUNCTUATION', ';')) {
                // e.g. int i = 0
                var isDecl = typeKeywords.includes(this.peek().value);
                if (isDecl) {
                    var dToken = this.next();
                    var nameToken = this.consume('IDENTIFIER');
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
                    var expr_3 = this.parseExpression();
                    init = {
                        type: 'ExpressionStatement',
                        expr: expr_3,
                        loc: expr_3.loc
                    };
                }
            }
            this.consume('PUNCTUATION', ';');
            var condition = this.parseExpression();
            this.consume('PUNCTUATION', ';');
            var update = void 0;
            if (!this.match('PUNCTUATION', ')')) {
                var expr_4 = this.parseExpression();
                update = {
                    type: 'ExpressionStatement',
                    expr: expr_4,
                    loc: expr_4.loc
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
        // Output: printf(format, args)
        if ((t.type === 'KEYWORD' || t.type === 'IDENTIFIER') && t.value === 'printf') {
            var startToken = this.next();
            this.consume('PUNCTUATION', '(');
            var exprs = [];
            while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
                exprs.push(this.parseExpression());
                if (this.match('PUNCTUATION', ','))
                    this.next();
            }
            this.consume('PUNCTUATION', ')');
            this.consume('PUNCTUATION', ';');
            return {
                type: 'Output',
                exprs: exprs,
                appendNewline: false,
                loc: this.getLoc(startToken)
            };
        }
        // Input: scanf(format, &x)
        if (t.type === 'KEYWORD' && t.value === 'scanf') {
            var startToken = this.next();
            this.consume('PUNCTUATION', '(');
            var formatStrToken = this.consume('STRING');
            this.consume('PUNCTUATION', ',');
            var targetExpr = this.parseExpression(); // should be &x AddressOf
            this.consume('PUNCTUATION', ')');
            this.consume('PUNCTUATION', ';');
            // Deduce expected type from format string e.g. %d -> integer, %f -> float, %s -> string
            var expectedType = 'string';
            if (formatStrToken.value.includes('%d'))
                expectedType = 'integer';
            else if (formatStrToken.value.includes('%f'))
                expectedType = 'float';
            return {
                type: 'Input',
                prompt: "Enter ".concat(expectedType, ":"),
                target: targetExpr,
                expectedType: expectedType,
                loc: this.getLoc(startToken)
            };
        }
        // General expressions / assignments
        var expr = this.parseExpression();
        this.consume('PUNCTUATION', ';');
        return {
            type: 'ExpressionStatement',
            expr: expr,
            loc: expr.loc
        };
    };
    CParser.prototype.parseBlock = function () {
        var body = [];
        while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
            var stmt = this.parseStatement();
            if (stmt)
                body.push(stmt);
        }
        this.consume('PUNCTUATION', '}');
        return body;
    };
    return CParser;
}(parser_1.BaseParser));
exports.CParser = CParser;
