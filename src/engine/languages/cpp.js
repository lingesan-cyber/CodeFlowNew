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
exports.CPPParser = void 0;
var parser_1 = require("../parser");
var CPPParser = /** @class */ (function (_super) {
    __extends(CPPParser, _super);
    function CPPParser(code) {
        var _this = _super.call(this, code, 'cpp') || this;
        _this.currentClassName = null;
        return _this;
    }
    CPPParser.prototype.parse = function () {
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
    CPPParser.prototype.parseStatement = function () {
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
        // Class definition: class ClassName { public: ... };
        if (t.type === 'KEYWORD' && t.value === 'class') {
            var startToken = this.next();
            var className = this.consume('IDENTIFIER');
            var baseClass = void 0;
            if (this.match('OPERATOR', ':')) {
                this.next(); // consume :
                if (this.match('KEYWORD', 'public') || this.match('KEYWORD', 'private') || this.match('KEYWORD', 'protected') || this.match('IDENTIFIER', 'public') || this.match('IDENTIFIER', 'private') || this.match('IDENTIFIER', 'protected')) {
                    this.next();
                }
                baseClass = this.consume('IDENTIFIER').value; // consume base class
            }
            this.consume('PUNCTUATION', '{');
            var prevClass = this.currentClassName;
            this.currentClassName = className.value;
            var body = [];
            while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
                var nextToken = this.peek();
                // Skip access specifiers: public:, private:, protected:
                if ((nextToken.type === 'KEYWORD' || nextToken.type === 'IDENTIFIER') && (nextToken.value === 'public' || nextToken.value === 'private' || nextToken.value === 'protected')) {
                    this.next(); // consume keyword
                    this.consume('OPERATOR', ':');
                    continue;
                }
                // Parse class member
                var memberStmt = this.parseCPPClassMember(className.value);
                if (memberStmt) {
                    body.push(memberStmt);
                }
            }
            this.consume('PUNCTUATION', '}');
            this.consume('PUNCTUATION', ';'); // class definition ends with a semicolon in C++
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
        // Skip includes and namespaces: #include <iostream>, using namespace std;
        if (t.type === 'OPERATOR' && t.value === '#') {
            while (!this.match('NEWLINE') && !this.match('EOF')) {
                this.next();
            }
            return null;
        }
        if (t.type === 'KEYWORD' && t.value === 'using') {
            while (!this.match('PUNCTUATION', ';') && !this.match('EOF')) {
                this.next();
            }
            this.consume('PUNCTUATION', ';');
            return null;
        }
        // Output: cout << x << endl; or std::cout << x << endl;
        var isCout = false;
        var coutStartToken = t;
        if ((t.type === 'KEYWORD' || t.type === 'IDENTIFIER') && t.value === 'cout') {
            isCout = true;
            coutStartToken = this.next(); // consume cout
        }
        else if (t.type === 'IDENTIFIER' && t.value === 'std' && this.peek(1).value === '::' && this.peek(2).value === 'cout') {
            isCout = true;
            coutStartToken = this.next(); // consume std
            this.next(); // consume ::
            this.next(); // consume cout
        }
        if (isCout) {
            var exprs = [];
            while (this.match('OPERATOR', '<<')) {
                this.next(); // consume <<
                // Check if next is endl or std::endl
                var isEndl = false;
                if (this.match('IDENTIFIER', 'endl')) {
                    isEndl = true;
                    this.next();
                }
                else if (this.match('IDENTIFIER', 'std') && this.peek(1).value === '::' && this.peek(2).value === 'endl') {
                    isEndl = true;
                    this.next(); // std
                    this.next(); // ::
                    this.next(); // endl
                }
                if (isEndl) {
                    exprs.push({ type: 'Literal', value: '\n', valueType: 'string', loc: this.getLoc(coutStartToken) });
                }
                else {
                    exprs.push(this.parseExpression());
                }
            }
            this.consume('PUNCTUATION', ';');
            return {
                type: 'Output',
                exprs: exprs,
                appendNewline: false,
                loc: this.getLoc(coutStartToken)
            };
        }
        // Input: cin >> x >> y; or std::cin >> x >> y;
        var isCin = false;
        var cinStartToken = t;
        if (t.type === 'KEYWORD' && t.value === 'cin') {
            isCin = true;
            cinStartToken = this.next(); // consume cin
        }
        else if (t.type === 'IDENTIFIER' && t.value === 'std' && this.peek(1).value === '::' && this.peek(2).value === 'cin') {
            isCin = true;
            cinStartToken = this.next(); // consume std
            this.next(); // consume ::
            this.next(); // consume cin
        }
        if (isCin) {
            this.consume('OPERATOR', '>>');
            var targetExpr = this.parseExpression(); // Identifier or ArrayAccess
            this.consume('PUNCTUATION', ';');
            return {
                type: 'Input',
                prompt: "Enter value:",
                target: targetExpr,
                expectedType: 'string', // Type checking resolved by variable target in runtime
                loc: this.getLoc(cinStartToken)
            };
        }
        // CPP Types including class, vectors, templates
        var typeKeywords = ['int', 'float', 'char', 'double', 'void', 'struct', 'bool', 'string', 'vector'];
        // We can also have pointers: int *p
        var isType = typeKeywords.includes(t.value) ||
            (t.type === 'IDENTIFIER' && this.peek(1).type === 'OPERATOR' && this.peek(1).value === '*') ||
            (t.type === 'IDENTIFIER' && this.peek(1).type === 'OPERATOR' && this.peek(1).value === '<'); // templates like vector<int>
        if (!isType && t.type === 'IDENTIFIER') {
            var idx = 1;
            while (this.peek(idx).type === 'OPERATOR' && (this.peek(idx).value === '*' || this.peek(idx).value === '&')) {
                idx++;
            }
            if (this.peek(idx).type === 'IDENTIFIER') {
                isType = true;
            }
        }
        var typePrefix = '';
        if (!isType && t.type === 'IDENTIFIER' && t.value === 'std' && this.peek(1).value === '::') {
            var actualType = this.peek(2);
            if (typeKeywords.includes(actualType.value) || actualType.type === 'IDENTIFIER') {
                isType = true;
            }
        }
        if (isType) {
            var startToken = t;
            if (t.type === 'IDENTIFIER' && t.value === 'std' && this.peek(1).value === '::') {
                this.next(); // std
                this.next(); // ::
                typePrefix = 'std::';
                startToken = this.peek();
            }
            this.next(); // e.g. int, vector, string
            var varType = typePrefix + startToken.value;
            // Handle struct definition skipping in C++
            if (startToken.value === 'struct' && this.match('IDENTIFIER')) {
                var structName = this.next();
                varType += ' ' + structName.value;
                // Is it a struct definition: struct Node { ... };
                if (this.match('PUNCTUATION', '{')) {
                    this.next();
                    // Skip struct fields
                    while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
                        this.next();
                    }
                    this.consume('PUNCTUATION', '}');
                    this.consume('PUNCTUATION', ';');
                    return null;
                }
            }
            // Handle templates e.g. vector<int>, map<string, int>
            if (this.match('OPERATOR', '<')) {
                this.next(); // consume <
                var innerTypeStr = '';
                var depth = 1;
                while (depth > 0 && !this.match('EOF')) {
                    var tok = this.peek();
                    if (tok.type === 'OPERATOR' && tok.value === '<') {
                        depth++;
                        innerTypeStr += tok.value;
                        this.next();
                    }
                    else if (tok.type === 'OPERATOR' && tok.value === '>') {
                        depth--;
                        if (depth > 0) {
                            innerTypeStr += tok.value;
                            this.next();
                        }
                        else {
                            this.next();
                            break;
                        }
                    }
                    else {
                        innerTypeStr += tok.value;
                        this.next();
                    }
                }
                varType += '<' + innerTypeStr + '>';
            }
            // Check pointers: count *
            while (this.match('OPERATOR', '*')) {
                this.next();
                varType += '*';
            }
            var nameToken = this.consume('IDENTIFIER');
            // Check if it's a function declaration e.g. int solve(...) { ... }
            var isFuncDecl = false;
            if (this.match('PUNCTUATION', '(')) {
                if (this.peek(1).value === ')') {
                    isFuncDecl = true;
                }
                else {
                    var wordCount = 0;
                    var idx = 1;
                    while (this.peek(idx).value !== ',' && this.peek(idx).value !== ')' && this.peek(idx).type !== 'EOF') {
                        var tok = this.peek(idx);
                        if (tok.type === 'IDENTIFIER' || tok.type === 'KEYWORD') {
                            wordCount++;
                        }
                        idx++;
                    }
                    if (wordCount >= 2) {
                        isFuncDecl = true;
                    }
                }
            }
            if (isFuncDecl) {
                this.next(); // consume (
                var params = [];
                while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
                    var pPrefix = '';
                    if (this.match('IDENTIFIER', 'std') && this.peek(1).value === '::') {
                        this.next(); // std
                        this.next(); // ::
                        pPrefix = 'std::';
                    }
                    var pTypeToken = this.next();
                    var pType = pPrefix + pTypeToken.value;
                    if (this.match('OPERATOR', '<')) {
                        this.next();
                        pType += '<' + this.next().value + '>';
                        this.consume('OPERATOR', '>');
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
            else if (this.match('PUNCTUATION', '(')) {
                // Constructor call syntax: Player p1("Hero", 15, 99.5);
                var startParen = this.next();
                var args = [];
                while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
                    args.push(this.parseExpression());
                    if (this.match('PUNCTUATION', ','))
                        this.next();
                }
                this.consume('PUNCTUATION', ')');
                valueExpr = {
                    type: 'NewInstance',
                    className: varType,
                    args: args,
                    loc: this.getLoc(startParen)
                };
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
        // Free memory allocation: delete p or delete[] p
        if (t.type === 'KEYWORD' && t.value === 'delete') {
            var startToken = this.next();
            if (this.match('PUNCTUATION', '[') && this.peek(1).value === ']') {
                this.next();
                this.next();
            }
            var expr_2 = this.parseExpression();
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
                var isDecl = typeKeywords.includes(this.peek().value);
                var forTypePrefix = '';
                if (!isDecl && this.match('IDENTIFIER', 'std') && this.peek(1).value === '::') {
                    if (typeKeywords.includes(this.peek(2).value) || this.peek(2).type === 'IDENTIFIER') {
                        isDecl = true;
                    }
                }
                if (isDecl) {
                    var forStartToken = this.peek();
                    if (this.match('IDENTIFIER', 'std') && this.peek(1).value === '::') {
                        this.next(); // std
                        this.next(); // ::
                        forTypePrefix = 'std::';
                        forStartToken = this.peek();
                    }
                    this.next(); // type
                    var nameToken = this.consume('IDENTIFIER');
                    if (this.match('OPERATOR', ':')) {
                        this.next(); // consume :
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
                        varType: forTypePrefix + forStartToken.value,
                        valueExpr: valExpr,
                        loc: this.getLoc(forStartToken)
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
        // General expressions / assignments
        var expr = this.parseExpression();
        this.consume('PUNCTUATION', ';');
        return {
            type: 'ExpressionStatement',
            expr: expr,
            loc: expr.loc
        };
    };
    CPPParser.prototype.parseBlock = function () {
        var body = [];
        while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
            var stmt = this.parseStatement();
            if (stmt)
                body.push(stmt);
        }
        this.consume('PUNCTUATION', '}');
        return body;
    };
    CPPParser.prototype.parseCPPClassMember = function (className) {
        var t = this.peek();
        // Check if it is a constructor: ClassName ( params ) { body }
        if (t.type === 'IDENTIFIER' && t.value === className && this.peek(1).type === 'PUNCTUATION' && this.peek(1).value === '(') {
            var constructorToken = this.next(); // consume ClassName
            this.consume('PUNCTUATION', '(');
            var params = [];
            // Prepend 'this' parameter for C++ constructor
            params.push({ name: 'this', type: 'any' });
            while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
                var pPrefix = '';
                if (this.match('IDENTIFIER', 'std') && this.peek(1).value === '::') {
                    this.next();
                    this.next();
                    pPrefix = 'std::';
                }
                var pTypeToken = this.next();
                var pType = pPrefix + pTypeToken.value;
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
                name: className + '.__init__',
                params: params,
                returnType: 'void',
                body: body,
                loc: this.getLoc(constructorToken)
            };
        }
        // Otherwise, parse it like a normal variable or method declaration
        var isType = false;
        var typePrefix = '';
        var startToken = t;
        if (t.type === 'IDENTIFIER' && t.value === 'std' && this.peek(1).value === '::') {
            isType = true;
        }
        else if (['int', 'float', 'char', 'double', 'void', 'bool', 'string'].includes(t.value)) {
            isType = true;
        }
        else if (t.type === 'IDENTIFIER') {
            isType = true;
        }
        if (isType) {
            if (t.type === 'IDENTIFIER' && t.value === 'std' && this.peek(1).value === '::') {
                this.next(); // std
                this.next(); // ::
                typePrefix = 'std::';
                startToken = this.peek();
            }
            this.next(); // consume type name
            var memberType = typePrefix + startToken.value;
            while (this.match('OPERATOR', '*')) {
                this.next();
                memberType += '*';
            }
            var nameToken = this.consume('IDENTIFIER');
            // If it's a method: ReturnType name ( params ) { body }
            if (this.match('PUNCTUATION', '(')) {
                this.next();
                var params = [];
                // Prepend 'this' parameter for C++ method
                params.push({ name: 'this', type: 'any' });
                while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
                    var pPrefix = '';
                    if (this.match('IDENTIFIER', 'std') && this.peek(1).value === '::') {
                        this.next();
                        this.next();
                        pPrefix = 'std::';
                    }
                    var pTypeToken = this.next();
                    var pType = pPrefix + pTypeToken.value;
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
                    name: className + '.' + nameToken.value,
                    params: params,
                    returnType: memberType,
                    body: body,
                    loc: this.getLoc(startToken)
                };
            }
            // Otherwise, it's a member field variable declaration: Type name;
            var valueExpr = void 0;
            if (this.match('OPERATOR', '=')) {
                this.next();
                valueExpr = this.parseExpression();
            }
            this.consume('PUNCTUATION', ';');
            return {
                type: 'VarDeclaration',
                name: nameToken.value,
                varType: memberType,
                valueExpr: valueExpr,
                loc: this.getLoc(startToken)
            };
        }
        this.next();
        return null;
    };
    return CPPParser;
}(parser_1.BaseParser));
exports.CPPParser = CPPParser;
