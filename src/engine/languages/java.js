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
exports.JavaParser = void 0;
var parser_1 = require("../parser");
var JavaParser = /** @class */ (function (_super) {
    __extends(JavaParser, _super);
    function JavaParser(code) {
        var _this = _super.call(this, code, 'java') || this;
        _this.currentClassName = null;
        return _this;
    }
    JavaParser.prototype.parse = function () {
        var statements = [];
        while (!this.match('EOF')) {
            try {
                var stmt = this.parseStatement();
                if (stmt) {
                    this.pushStmt(statements, stmt);
                }
            }
            catch (err) {
                throw err;
            }
        }
        return statements;
    };
    JavaParser.prototype.pushStmt = function (arr, s) {
        if (!s)
            return;
        if (Array.isArray(s)) {
            arr.push.apply(arr, s);
        }
        else {
            arr.push(s);
        }
    };
    JavaParser.prototype.parseStatement = function () {
        var t = this.peek();
        if (t.type === 'PUNCTUATION' && t.value === ';') {
            this.next();
            return null;
        }
        // Skip packages and imports
        if (t.type === 'KEYWORD' && (t.value === 'import' || t.value === 'package')) {
            while (!this.match('PUNCTUATION', ';') && !this.match('EOF')) {
                this.next();
            }
            this.consume('PUNCTUATION', ';');
            return null;
        }
        // Class definition: [modifiers] class ClassName { ... }
        var modifiers = ['public', 'private', 'protected', 'static', 'final'];
        var isClass = false;
        var lookahead = 0;
        while (lookahead < this.tokens.length - this.cursor) {
            var peekToken = this.peek(lookahead);
            if (modifiers.includes(peekToken.value)) {
                lookahead++;
            }
            else if (peekToken.type === 'KEYWORD' && peekToken.value === 'class') {
                isClass = true;
                break;
            }
            else {
                break;
            }
        }
        if (isClass) {
            var startToken = this.peek();
            // Consume modifiers
            while (modifiers.includes(this.peek().value)) {
                this.next();
            }
            this.consume('KEYWORD', 'class');
            var className = this.consume('IDENTIFIER');
            var baseClass = void 0;
            if (this.match('KEYWORD', 'extends')) {
                this.next(); // consume extends
                baseClass = this.consume('IDENTIFIER').value; // consume base class
            }
            if (this.match('KEYWORD', 'implements')) {
                this.next(); // consume implements
                this.consume('IDENTIFIER'); // consume interface
                while (this.match('PUNCTUATION', ',')) {
                    this.next();
                    this.consume('IDENTIFIER');
                }
            }
            this.consume('PUNCTUATION', '{');
            var prevClass = this.currentClassName;
            this.currentClassName = className.value;
            var body = this.parseClassBody();
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
        // Java declarations: constructors, methods, variables
        // First, let's scan if modifiers are present
        var hasModifiers = false;
        var modLookahead = 0;
        while (modLookahead < this.tokens.length - this.cursor) {
            if (modifiers.includes(this.peek(modLookahead).value)) {
                hasModifiers = true;
                modLookahead++;
            }
            else {
                break;
            }
        }
        // Now check if it's a declaration: Type name ... or name(...)
        var typeBuiltins = ['int', 'float', 'double', 'char', 'void', 'boolean', 'String', 'Scanner'];
        // Let's inspect the tokens after the modifiers
        var typeTokenPeek = this.peek(modLookahead);
        var nextTokenPeek = this.peek(modLookahead + 1);
        // A constructor: [modifiers] ClassName ( params ) { ... }
        var isConstructor = false;
        if (typeTokenPeek.type === 'IDENTIFIER' && nextTokenPeek.type === 'PUNCTUATION' && nextTokenPeek.value === '(') {
            isConstructor = true;
        }
        // A method or variable declaration: [modifiers] Type name
        var isVarOrMethod = false;
        if (!isConstructor && typeTokenPeek.type !== 'EOF') {
            if (typeBuiltins.includes(typeTokenPeek.value) || typeTokenPeek.type === 'IDENTIFIER') {
                // Can be: int name; or String name = ... or int name(args)
                // If the token after type is an identifier, or it's array like Type[] name
                var checkIdx = modLookahead + 1;
                if (this.peek(checkIdx).type === 'OPERATOR' && this.peek(checkIdx).value === '<') {
                    var depth = 1;
                    checkIdx++;
                    while (depth > 0 && checkIdx < this.tokens.length) {
                        var tok = this.peek(checkIdx);
                        if (tok.type === 'OPERATOR' && tok.value === '<')
                            depth++;
                        else if (tok.type === 'OPERATOR' && tok.value === '>')
                            depth--;
                        else if (tok.type === 'EOF')
                            break;
                        checkIdx++;
                    }
                }
                while (this.peek(checkIdx).value === '[' && this.peek(checkIdx + 1).value === ']') {
                    checkIdx += 2;
                }
                if (this.peek(checkIdx).type === 'IDENTIFIER') {
                    isVarOrMethod = true;
                }
            }
        }
        if (isConstructor || isVarOrMethod) {
            var startToken = this.peek();
            // Consume modifiers
            while (modifiers.includes(this.peek().value)) {
                this.next();
            }
            if (isConstructor) {
                var classNameToken = this.consume('IDENTIFIER');
                var funcName = classNameToken.value + '.__init__';
                this.consume('PUNCTUATION', '(');
                var params = [];
                if (this.currentClassName) {
                    params.push({ name: 'this', type: 'any' });
                }
                while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
                    var pTypeToken = this.next(); // parameter type
                    var pType = pTypeToken.value;
                    while (this.match('PUNCTUATION', '[') && this.peek(1).value === ']') {
                        this.next();
                        this.next();
                        pType += '[]';
                    }
                    var pName = this.consume('IDENTIFIER');
                    while (this.match('PUNCTUATION', '[') && this.peek(1).value === ']') {
                        this.next();
                        this.next();
                        pType += '[]';
                    }
                    params.push({ name: pName.value, type: pType });
                    if (this.match('PUNCTUATION', ','))
                        this.next();
                }
                this.consume('PUNCTUATION', ')');
                this.consume('PUNCTUATION', '{');
                var body = this.parseBlock();
                return {
                    type: 'FunctionDeclaration',
                    name: funcName,
                    params: params,
                    returnType: classNameToken.value,
                    body: body,
                    loc: this.getLoc(startToken)
                };
            }
            else {
                // Method or variable declaration
                var typeToken = this.next(); // return type e.g. void, int, String
                var varType = typeToken.value;
                if (this.match('OPERATOR', '<')) {
                    this.next();
                    while (!this.match('OPERATOR', '>') && !this.match('EOF')) {
                        var tok = this.next();
                        varType += tok.value;
                    }
                    this.consume('OPERATOR', '>');
                    varType += '<>';
                }
                while (this.match('PUNCTUATION', '[') && this.peek(1).value === ']') {
                    this.next();
                    this.next();
                    varType += '[]';
                }
                var nameToken = this.consume('IDENTIFIER');
                // Check if it is a method: Type name(params) { body }
                if (this.match('PUNCTUATION', '(')) {
                    this.next();
                    var params = [];
                    if (this.currentClassName) {
                        params.push({ name: 'this', type: 'any' });
                    }
                    while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
                        var pTypeToken = this.next(); // parameter type
                        var pType = pTypeToken.value;
                        while (this.match('PUNCTUATION', '[') && this.peek(1).value === ']') {
                            this.next();
                            this.next();
                            pType += '[]';
                        }
                        var pName = this.consume('IDENTIFIER');
                        while (this.match('PUNCTUATION', '[') && this.peek(1).value === ']') {
                            this.next();
                            this.next();
                            pType += '[]';
                        }
                        params.push({ name: pName.value, type: pType });
                        if (this.match('PUNCTUATION', ','))
                            this.next();
                    }
                    this.consume('PUNCTUATION', ')');
                    if (this.match('KEYWORD', 'throws')) {
                        this.next(); // consume throws
                        this.consume('IDENTIFIER');
                        while (this.match('PUNCTUATION', ',')) {
                            this.next();
                            this.consume('IDENTIFIER');
                        }
                    }
                    this.consume('PUNCTUATION', '{');
                    var body = this.parseBlock();
                    var funcName = nameToken.value;
                    if (this.currentClassName) {
                        funcName = this.currentClassName + '.' + funcName;
                    }
                    return {
                        type: 'FunctionDeclaration',
                        name: funcName,
                        params: params,
                        returnType: varType,
                        body: body,
                        loc: this.getLoc(startToken)
                    };
                }
                else {
                    // Variable declaration: Type name = value;
                    if (this.match('PUNCTUATION', '[') && this.peek(1).value === ']') {
                        this.next();
                        this.next();
                        varType += '[]';
                    }
                    var valueExpr = void 0;
                    if (this.match('OPERATOR', '=')) {
                        this.next();
                        valueExpr = this.parseExpression();
                    }
                    var firstStmt = void 0;
                    if (valueExpr && valueExpr.type === 'FunctionCall') {
                        var scannerMethods = ['nextInt', 'nextDouble', 'nextLine', 'nextFloat', 'next'];
                        if (scannerMethods.includes(valueExpr.name)) {
                            var expectedType = 'string';
                            if (valueExpr.name === 'nextInt')
                                expectedType = 'integer';
                            else if (valueExpr.name === 'nextDouble' || valueExpr.name === 'nextFloat')
                                expectedType = 'float';
                            firstStmt = {
                                type: 'Input',
                                prompt: "Enter ".concat(expectedType, " for ").concat(valueExpr.name, "():"),
                                target: { type: 'Identifier', name: nameToken.value, loc: this.getLoc(nameToken) },
                                expectedType: expectedType,
                                loc: this.getLoc(startToken)
                            };
                        }
                        else {
                            firstStmt = {
                                type: 'VarDeclaration',
                                name: nameToken.value,
                                varType: varType,
                                valueExpr: valueExpr,
                                loc: this.getLoc(startToken)
                            };
                        }
                    }
                    else {
                        firstStmt = {
                            type: 'VarDeclaration',
                            name: nameToken.value,
                            varType: varType,
                            valueExpr: valueExpr,
                            loc: this.getLoc(startToken)
                        };
                    }
                    var decls = [firstStmt];
                    while (this.match('PUNCTUATION', ',')) {
                        this.next(); // consume ','
                        var nextName = this.consume('IDENTIFIER');
                        var nextVal = void 0;
                        if (this.match('OPERATOR', '=')) {
                            this.next();
                            nextVal = this.parseExpression();
                        }
                        decls.push({
                            type: 'VarDeclaration',
                            name: nextName.value,
                            varType: varType,
                            valueExpr: nextVal,
                            loc: this.getLoc(nextName)
                        });
                    }
                    this.consume('PUNCTUATION', ';');
                    return decls;
                }
            }
        }
        // Return statement
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
                            this.pushStmt(body, s);
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
                            this.pushStmt(body, s);
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
        // Conditional
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
                    this.pushStmt(thenBody, singleStmt);
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
                        this.pushStmt(elifBody, singleStmt);
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
                        this.pushStmt(elseBody, singleStmt);
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
                    this.pushStmt(body, singleStmt);
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
                var next1 = this.peek(1);
                var next2 = this.peek(2);
                var typeBuiltins_1 = ['int', 'float', 'double', 'char', 'void', 'boolean', 'String', 'Scanner'];
                var isEnhancedFor = (next1.type === 'OPERATOR' && next1.value === ':') ||
                    (next2.type === 'OPERATOR' && next2.value === ':');
                if (isEnhancedFor) {
                    var varName = '';
                    var varType = 'any';
                    if (next1.value === ':') {
                        var nameToken = this.next();
                        varName = nameToken.value;
                    }
                    else {
                        var typeToken = this.next();
                        varType = typeToken.value;
                        var nameToken = this.next();
                        varName = nameToken.value;
                    }
                    this.consume('OPERATOR', ':');
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
                            this.pushStmt(body_1, singleStmt);
                    }
                    return {
                        type: 'Loop',
                        loopType: 'for-range',
                        iteratorVar: varName,
                        iterable: iterable,
                        body: body_1,
                        loc: this.getLoc(startToken)
                    };
                }
                var isDecl = typeBuiltins_1.includes(this.peek(0).value) ||
                    (this.peek(0).type === 'IDENTIFIER' && this.peek(1).type === 'IDENTIFIER');
                if (isDecl) {
                    var typeToken = this.next();
                    var varType = typeToken.value;
                    if (this.match('PUNCTUATION', '[') && this.peek(1).value === ']') {
                        this.next();
                        this.next();
                        varType += '[]';
                    }
                    var nameToken = this.consume('IDENTIFIER');
                    this.consume('OPERATOR', '=');
                    var valExpr = this.parseExpression();
                    init = {
                        type: 'VarDeclaration',
                        name: nameToken.value,
                        varType: varType,
                        valueExpr: valExpr,
                        loc: this.getLoc(typeToken)
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
            if (!this.match('PUNCTUATION', '))')) {
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
                    this.pushStmt(body, singleStmt);
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
        // Output: System.out.println(args) or System.out.print(args)
        if ((t.type === 'KEYWORD' || t.type === 'IDENTIFIER') &&
            t.value === 'System' &&
            this.peek(1).value === '.' &&
            this.peek(2).value === 'out' &&
            this.peek(3).value === '.') {
            var startToken = this.next(); // System
            this.consume('PUNCTUATION', '.'); // .
            this.next(); // out (can be KEYWORD or IDENTIFIER)
            this.consume('PUNCTUATION', '.'); // .
            var printMethodToken = this.next(); // consume print or println (IDENTIFIER or KEYWORD)
            var appendNewline = printMethodToken.value === 'println';
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
                appendNewline: appendNewline,
                loc: this.getLoc(startToken)
            };
        }
        // General expressions / assignments
        var expr = this.parseExpression();
        this.consume('PUNCTUATION', ';');
        // Handle Java Scanner inputs: sc.nextInt() or sc.nextLine()
        // Handle Java Scanner inputs: sc.nextInt() or sc.nextLine()
        if (expr.type === 'BinaryOp' && expr.operator === '=' && expr.right.type === 'FunctionCall') {
            var call = expr.right;
            var scannerMethods = ['nextInt', 'nextDouble', 'nextLine', 'nextFloat', 'next'];
            if (scannerMethods.includes(call.name)) {
                var expectedType = 'string';
                if (call.name === 'nextInt')
                    expectedType = 'integer';
                else if (call.name === 'nextDouble' || call.name === 'nextFloat')
                    expectedType = 'float';
                return {
                    type: 'Input',
                    prompt: "Enter ".concat(expectedType, " for ").concat(call.name, "():"),
                    target: expr.left,
                    expectedType: expectedType,
                    loc: expr.loc
                };
            }
        }
        return {
            type: 'ExpressionStatement',
            expr: expr,
            loc: expr.loc
        };
    };
    JavaParser.prototype.parseBlock = function () {
        var body = [];
        while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
            var stmt = this.parseStatement();
            if (stmt)
                this.pushStmt(body, stmt);
        }
        this.consume('PUNCTUATION', '}');
        return body;
    };
    JavaParser.prototype.parseClassBody = function () {
        var body = [];
        while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
            var stmt = this.parseStatement();
            if (stmt)
                this.pushStmt(body, stmt);
        }
        this.consume('PUNCTUATION', '}');
        return body;
    };
    return JavaParser;
}(parser_1.BaseParser));
exports.JavaParser = JavaParser;
