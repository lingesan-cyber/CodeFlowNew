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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASTInterpreter = void 0;
var javascript_1 = require("./languages/javascript");
var python_1 = require("./languages/python");
var java_1 = require("./languages/java");
var c_1 = require("./languages/c");
var cpp_1 = require("./languages/cpp");
var ASTInterpreter = /** @class */ (function () {
    function ASTInterpreter(code, lang) {
        this.statements = [];
        // Environment State
        this.globals = new Map();
        this.stack = [];
        this.heap = new Map();
        this.stdout = '';
        this.returnVal = null;
        this.isReturning = false;
        this.isBroken = false;
        // Tracing State
        this.steps = [];
        this.stepCount = 0;
        this.maxSteps = 1000;
        this.startTime = 0;
        this.timeoutMs = 5000;
        // Memory Addresses
        this.nextStackAddr = 0x7ffe000;
        this.nextHeapAddr = 0x1000;
        this.addrToVarName = new Map();
        this.varNameToAddr = new Map();
        this.code = code;
        this.lang = lang;
        // Compile code to Common AST
        var parser = this.getParser(code, lang);
        this.statements = parser.parse();
    }
    ASTInterpreter.prototype.getParser = function (code, lang) {
        switch (lang) {
            case 'javascript': return new javascript_1.JSParser(code);
            case 'python': return new python_1.PythonParser(code);
            case 'java': return new java_1.JavaParser(code);
            case 'c': return new c_1.CParser(code);
            case 'cpp': return new cpp_1.CPPParser(code);
            default: throw new Error("Unsupported language: ".concat(lang));
        }
    };
    ASTInterpreter.prototype.getNextStackAddress = function () {
        var addr = "0x".concat(this.nextStackAddr.toString(16).toUpperCase());
        this.nextStackAddr -= 4; // Decrement stack addresses
        return addr;
    };
    ASTInterpreter.prototype.getNextHeapAddress = function () {
        var addr = "0x".concat(this.nextHeapAddr.toString(16).toUpperCase());
        this.nextHeapAddr += 16; // Increment heap addresses
        return addr;
    };
    // Run interpreter generator
    ASTInterpreter.prototype.run = function () {
        var functionRegistry, registerFunctions, _i, _a, stmt, hasMain, mainCall, finalStep, err_1, line, errorMsg, errorStep;
        var _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    this.startTime = Date.now();
                    this.steps = [];
                    this.stepCount = 0;
                    this.globals.clear();
                    this.stack = [];
                    this.heap.clear();
                    this.stdout = '';
                    this.isReturning = false;
                    this.isBroken = false;
                    this.addrToVarName.clear();
                    this.varNameToAddr.clear();
                    functionRegistry = new Map();
                    registerFunctions = function (stmts) {
                        for (var _i = 0, stmts_1 = stmts; _i < stmts_1.length; _i++) {
                            var stmt = stmts_1[_i];
                            if (stmt.type === 'FunctionDeclaration') {
                                functionRegistry.set(stmt.name, stmt);
                                registerFunctions(stmt.body);
                            }
                            else if (stmt.type === 'Conditional') {
                                registerFunctions(stmt.thenBody);
                                if (stmt.elseBody)
                                    registerFunctions(stmt.elseBody);
                            }
                            else if (stmt.type === 'Loop') {
                                registerFunctions(stmt.body);
                            }
                        }
                    };
                    registerFunctions(this.statements);
                    // Set up initial global frame
                    this.stack.push({
                        functionName: this.lang === 'python' ? 'module' : 'global',
                        line: ((_b = this.statements[0]) === null || _b === void 0 ? void 0 : _b.loc.line) || 1,
                        parameters: {},
                        variables: []
                    });
                    _f.label = 1;
                case 1:
                    _f.trys.push([1, 8, , 9]);
                    _i = 0, _a = this.statements;
                    _f.label = 2;
                case 2:
                    if (!(_i < _a.length)) return [3 /*break*/, 5];
                    stmt = _a[_i];
                    if (stmt.type === 'FunctionDeclaration')
                        return [3 /*break*/, 4]; // Hoisted
                    return [5 /*yield**/, // Hoisted
                        __values(this.executeStatement(stmt, functionRegistry))];
                case 3:
                    _f.sent();
                    if (Date.now() - this.startTime > this.timeoutMs) {
                        throw new Error('Execution timeout: infinite loop detected');
                    }
                    if (this.stepCount >= this.maxSteps) {
                        throw new Error('Maximum execution steps exceeded');
                    }
                    _f.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    hasMain = functionRegistry.has('main');
                    if (!(hasMain && (this.lang === 'c' || this.lang === 'cpp' || this.lang === 'java'))) return [3 /*break*/, 7];
                    mainCall = {
                        type: 'ExpressionStatement',
                        expr: {
                            type: 'FunctionCall',
                            name: 'main',
                            args: [],
                            loc: { line: 1, columnStart: 1, columnEnd: 1 }
                        },
                        loc: { line: 1, columnStart: 1, columnEnd: 1 }
                    };
                    return [5 /*yield**/, __values(this.executeStatement(mainCall, functionRegistry))];
                case 6:
                    _f.sent();
                    _f.label = 7;
                case 7:
                    finalStep = this.createStep(((_c = this.statements[this.statements.length - 1]) === null || _c === void 0 ? void 0 : _c.loc.line) || 1, 'system', 'Execution completed successfully.', (_d = this.statements[this.statements.length - 1]) === null || _d === void 0 ? void 0 : _d.loc);
                    this.steps.push(finalStep);
                    return [2 /*return*/, this.steps];
                case 8:
                    err_1 = _f.sent();
                    line = ((_e = this.peek()) === null || _e === void 0 ? void 0 : _e.line) || 1;
                    errorMsg = err_1 instanceof Error ? err_1.message : 'Runtime error';
                    errorStep = this.createStep(line, 'error', "Error: ".concat(errorMsg));
                    errorStep.error = { message: errorMsg, line: line };
                    this.steps.push(errorStep);
                    return [2 /*return*/, this.steps];
                case 9: return [2 /*return*/];
            }
        });
    };
    ASTInterpreter.prototype.peek = function () {
        var _a;
        return (_a = this.statements[0]) === null || _a === void 0 ? void 0 : _a.loc;
    };
    ASTInterpreter.prototype.executeStatement = function (stmt, funcs) {
        var line, _a, val, _b, type, val, cond, _i, _c, subStmt, _d, _e, subStmt, iterationCount, _f, _g, subStmt, cond, _h, _j, subStmt, val, _k, outputs, _l, _m, e, _o, _p, outStr, appendNewline, sep, targetVarName, isAddr, inputRequest, traceStep, inputVal, parsedVal, expectedType, v, addr, expr, isAssignment;
        var _this = this;
        return __generator(this, function (_q) {
            switch (_q.label) {
                case 0:
                    if (this.isReturning || this.isBroken)
                        return [2 /*return*/];
                    if (Date.now() - this.startTime > this.timeoutMs) {
                        throw new Error('Execution timeout: infinite loop detected');
                    }
                    if (this.stepCount >= this.maxSteps) {
                        throw new Error('Maximum execution steps exceeded');
                    }
                    line = stmt.loc.line;
                    _a = stmt.type;
                    switch (_a) {
                        case 'VarDeclaration': return [3 /*break*/, 1];
                        case 'Assignment': return [3 /*break*/, 6];
                        case 'Conditional': return [3 /*break*/, 10];
                        case 'Loop': return [3 /*break*/, 22];
                        case 'ReturnStatement': return [3 /*break*/, 39];
                        case 'BreakStatement': return [3 /*break*/, 44];
                        case 'Output': return [3 /*break*/, 46];
                        case 'Input': return [3 /*break*/, 52];
                        case 'Free': return [3 /*break*/, 59];
                        case 'ExpressionStatement': return [3 /*break*/, 62];
                    }
                    return [3 /*break*/, 66];
                case 1:
                    if (!stmt.valueExpr) return [3 /*break*/, 3];
                    return [5 /*yield**/, __values(this.evaluateExpression(stmt.valueExpr, funcs))];
                case 2:
                    _b = _q.sent();
                    return [3 /*break*/, 4];
                case 3:
                    _b = undefined;
                    _q.label = 4;
                case 4:
                    val = _b;
                    type = stmt.varType;
                    this.declareVariable(stmt.name, val, type);
                    return [4 /*yield*/, this.createStep(line, 'declaration', "Declare variable \"".concat(stmt.name, "\" of type ").concat(type).concat(val !== undefined ? " and assign value ".concat(JSON.stringify(val)) : ''), stmt.loc)];
                case 5:
                    _q.sent();
                    return [3 /*break*/, 66];
                case 6: return [5 /*yield**/, __values(this.evaluateExpression(stmt.valueExpr, funcs))];
                case 7:
                    val = _q.sent();
                    return [5 /*yield**/, __values(this.assignValue(stmt.target, val, funcs))];
                case 8:
                    _q.sent();
                    return [4 /*yield*/, this.createStep(line, 'assignment', "Assign value to ".concat(this.exprToString(stmt.target), ": ").concat(JSON.stringify(val)), stmt.loc)];
                case 9:
                    _q.sent();
                    return [3 /*break*/, 66];
                case 10: return [5 /*yield**/, __values(this.evaluateExpression(stmt.condition, funcs))];
                case 11:
                    cond = _q.sent();
                    return [4 /*yield*/, this.createStep(line, 'conditional', "Evaluate condition: ".concat(this.exprToString(stmt.condition), " -> ").concat(cond), stmt.loc)];
                case 12:
                    _q.sent();
                    if (!cond) return [3 /*break*/, 17];
                    _i = 0, _c = stmt.thenBody;
                    _q.label = 13;
                case 13:
                    if (!(_i < _c.length)) return [3 /*break*/, 16];
                    subStmt = _c[_i];
                    return [5 /*yield**/, __values(this.executeStatement(subStmt, funcs))];
                case 14:
                    _q.sent();
                    if (this.isReturning)
                        return [3 /*break*/, 16];
                    _q.label = 15;
                case 15:
                    _i++;
                    return [3 /*break*/, 13];
                case 16: return [3 /*break*/, 21];
                case 17:
                    if (!stmt.elseBody) return [3 /*break*/, 21];
                    _d = 0, _e = stmt.elseBody;
                    _q.label = 18;
                case 18:
                    if (!(_d < _e.length)) return [3 /*break*/, 21];
                    subStmt = _e[_d];
                    return [5 /*yield**/, __values(this.executeStatement(subStmt, funcs))];
                case 19:
                    _q.sent();
                    if (this.isReturning)
                        return [3 /*break*/, 21];
                    _q.label = 20;
                case 20:
                    _d++;
                    return [3 /*break*/, 18];
                case 21: return [3 /*break*/, 66];
                case 22:
                    iterationCount = 0;
                    console.log("LOOP ENTER");
                    console.log("LOOP BODY LENGTH:", stmt.body.length);
                    if (!stmt.init) return [3 /*break*/, 29];
                    if (!Array.isArray(stmt.init)) return [3 /*break*/, 27];
                    _f = 0, _g = stmt.init;
                    _q.label = 23;
                case 23:
                    if (!(_f < _g.length)) return [3 /*break*/, 26];
                    subStmt = _g[_f];
                    return [5 /*yield**/, __values(this.executeStatement(subStmt, funcs))];
                case 24:
                    _q.sent();
                    _q.label = 25;
                case 25:
                    _f++;
                    return [3 /*break*/, 23];
                case 26: return [3 /*break*/, 29];
                case 27: return [5 /*yield**/, __values(this.executeStatement(stmt.init, funcs))];
                case 28:
                    _q.sent();
                    _q.label = 29;
                case 29:
                    if (!true) return [3 /*break*/, 38];
                    return [5 /*yield**/, __values(this.evaluateExpression(stmt.condition, funcs))];
                case 30:
                    cond = _q.sent();
                    if (stmt.loopType === 'while') {
                        console.log("WHILE CONDITION:", cond);
                    }
                    return [4 /*yield*/, this.createStep(line, 'loop_start', "Evaluate loop condition: ".concat(this.exprToString(stmt.condition), " -> ").concat(cond), stmt.loc)];
                case 31:
                    _q.sent();
                    if (!cond)
                        return [3 /*break*/, 38];
                    if (stmt.loopType === 'while') {
                        iterationCount++;
                        console.log("ENTERING LOOP BODY");
                        console.log("LOOP ITERATION:", iterationCount);
                    }
                    _h = 0, _j = stmt.body;
                    _q.label = 32;
                case 32:
                    if (!(_h < _j.length)) return [3 /*break*/, 35];
                    subStmt = _j[_h];
                    console.log("EXECUTING BODY STATEMENT", subStmt.type);
                    return [5 /*yield**/, __values(this.executeStatement(subStmt, funcs))];
                case 33:
                    _q.sent();
                    if (this.isReturning || this.isBroken)
                        return [3 /*break*/, 35];
                    _q.label = 34;
                case 34:
                    _h++;
                    return [3 /*break*/, 32];
                case 35:
                    if (this.isReturning || this.isBroken)
                        return [3 /*break*/, 38];
                    if (!stmt.update) return [3 /*break*/, 37];
                    return [5 /*yield**/, __values(this.executeStatement(stmt.update, funcs))];
                case 36:
                    _q.sent();
                    _q.label = 37;
                case 37: return [3 /*break*/, 29];
                case 38:
                    console.log("LOOP EXIT");
                    this.isBroken = false;
                    return [3 /*break*/, 66];
                case 39:
                    if (!stmt.valueExpr) return [3 /*break*/, 41];
                    return [5 /*yield**/, __values(this.evaluateExpression(stmt.valueExpr, funcs))];
                case 40:
                    _k = _q.sent();
                    return [3 /*break*/, 42];
                case 41:
                    _k = null;
                    _q.label = 42;
                case 42:
                    val = _k;
                    this.returnVal = val;
                    this.isReturning = true;
                    return [4 /*yield*/, this.createStep(line, 'return', "Return value: ".concat(JSON.stringify(val)), stmt.loc)];
                case 43:
                    _q.sent();
                    return [3 /*break*/, 66];
                case 44:
                    this.isBroken = true;
                    console.log("BREAK EXECUTED");
                    return [4 /*yield*/, this.createStep(line, 'system', 'Break executed. Exiting loop.', stmt.loc)];
                case 45:
                    _q.sent();
                    return [3 /*break*/, 66];
                case 46:
                    outputs = [];
                    _l = 0, _m = stmt.exprs;
                    _q.label = 47;
                case 47:
                    if (!(_l < _m.length)) return [3 /*break*/, 50];
                    e = _m[_l];
                    _p = (_o = outputs).push;
                    return [5 /*yield**/, __values(this.evaluateExpression(e, funcs))];
                case 48:
                    _p.apply(_o, [_q.sent()]);
                    _q.label = 49;
                case 49:
                    _l++;
                    return [3 /*break*/, 47];
                case 50:
                    outStr = '';
                    appendNewline = stmt.appendNewline !== false;
                    if ((this.lang === 'c' || this.lang === 'cpp') && outputs.length > 0 && typeof outputs[0] === 'string') {
                        outStr = this.formatPrintf(outputs[0], outputs.slice(1));
                    }
                    else {
                        sep = (this.lang === 'c' || this.lang === 'cpp' || this.lang === 'java') ? '' : ' ';
                        outStr = outputs.map(function (o) {
                            if (o === null || o === undefined)
                                return 'null';
                            if (typeof o === 'string')
                                return _this.unescapeString(o);
                            return String(o);
                        }).join(sep);
                    }
                    if (appendNewline) {
                        outStr += '\n';
                    }
                    this.stdout += outStr;
                    return [4 /*yield*/, this.createStep(line, 'output', "Print output: ".concat(outStr.replace(/\n$/, '').trim()), stmt.loc)];
                case 51:
                    _q.sent();
                    return [3 /*break*/, 66];
                case 52:
                    targetVarName = '';
                    isAddr = false;
                    if (stmt.target.type === 'Identifier') {
                        targetVarName = stmt.target.name;
                    }
                    else if (stmt.target.type === 'AddressOf') {
                        targetVarName = stmt.target.targetName;
                        isAddr = true;
                    }
                    inputRequest = {
                        promptMessage: stmt.prompt,
                        variableName: targetVarName,
                        expectedType: stmt.expectedType
                    };
                    traceStep = this.createStep(line, 'input_request', "Awaiting input for \"".concat(targetVarName, "\": \"").concat(stmt.prompt, "\""), stmt.loc);
                    traceStep.awaitingInput = inputRequest;
                    return [4 /*yield*/, traceStep];
                case 53:
                    inputVal = _q.sent();
                    // Reset timeout start time so the user's typing time doesn't trigger loop timeout
                    this.startTime = Date.now();
                    parsedVal = inputVal || '';
                    expectedType = stmt.expectedType;
                    if (expectedType === 'string' && stmt.target.type === 'Identifier') {
                        v = this.lookupVariable(stmt.target.name);
                        if (v) {
                            if (v.type === 'int' || v.type === 'integer') {
                                expectedType = 'integer';
                            }
                            else if (v.type === 'float' || v.type === 'double' || v.type === 'number') {
                                expectedType = 'float';
                            }
                        }
                    }
                    if (expectedType === 'integer') {
                        parsedVal = parseInt(inputVal || '0', 10);
                        if (isNaN(parsedVal))
                            parsedVal = 0;
                    }
                    else if (expectedType === 'float' || expectedType === 'number') {
                        parsedVal = parseFloat(inputVal || '0.0');
                        if (isNaN(parsedVal))
                            parsedVal = 0.0;
                    }
                    if (!isAddr) return [3 /*break*/, 55];
                    return [5 /*yield**/, __values(this.assignValue({ type: 'Identifier', name: targetVarName, loc: stmt.target.loc }, parsedVal, funcs))];
                case 54:
                    _q.sent();
                    return [3 /*break*/, 57];
                case 55: return [5 /*yield**/, __values(this.assignValue(stmt.target, parsedVal, funcs))];
                case 56:
                    _q.sent();
                    _q.label = 57;
                case 57: return [4 /*yield*/, this.createStep(line, 'assignment', "Input received: ".concat(JSON.stringify(parsedVal), ". Assigning to variable \"").concat(targetVarName, "\"."), stmt.loc)];
                case 58:
                    _q.sent();
                    return [3 /*break*/, 66];
                case 59: return [5 /*yield**/, __values(this.evaluateExpression(stmt.expr, funcs))];
                case 60:
                    addr = _q.sent();
                    if (typeof addr === 'string' && this.heap.has(addr)) {
                        this.heap.delete(addr);
                    }
                    return [4 /*yield*/, this.createStep(line, 'assignment', "Free heap memory at address: ".concat(addr), stmt.loc)];
                case 61:
                    _q.sent();
                    return [3 /*break*/, 66];
                case 62: return [5 /*yield**/, __values(this.evaluateExpression(stmt.expr, funcs))];
                case 63:
                    _q.sent();
                    expr = stmt.expr;
                    isAssignment = expr.type === 'BinaryOp' && [
                        '=', '+=', '-=', '*=', '/=', '%=',
                        '++_prefix', '--_prefix', '++_postfix', '--_postfix'
                    ].includes(expr.operator);
                    if (!isAssignment) return [3 /*break*/, 65];
                    return [4 /*yield*/, this.createStep(line, 'assignment', "Update variable: ".concat(this.exprToString(expr)), stmt.loc)];
                case 64:
                    _q.sent();
                    _q.label = 65;
                case 65: return [3 /*break*/, 66];
                case 66: return [2 /*return*/];
            }
        });
    };
    ASTInterpreter.prototype.declareVariable = function (name, val, type) {
        var frame = this.stack[this.stack.length - 1];
        var isGlobal = this.stack.length === 1;
        // Check if variable already exists (or shadow it)
        var addr = this.getNextStackAddress();
        this.addrToVarName.set(addr, name);
        this.varNameToAddr.set(name, addr);
        var isRef = type.includes('*') || type === 'vector' || type.includes('[]');
        var referencedId;
        if (isRef && typeof val === 'string') {
            referencedId = val; // pointer address or heap id
        }
        var newVar = {
            name: name,
            value: val === undefined ? null : val,
            type: type,
            scope: isGlobal ? 'global' : 'local',
            isReference: isRef,
            referencedId: referencedId
        };
        if (isGlobal) {
            this.globals.set(name, newVar);
        }
        else {
            frame.variables.push(name);
            // Place in frame parameter values or variables registry
            frame.parameters[name] = newVar;
        }
    };
    ASTInterpreter.prototype.assignValue = function (target, val, funcs) {
        var name_1, variable, addr, stackVarName, variable, heapObj, arrAddr, index, heapObj, objAddr, heapObj;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(target.type === 'Identifier')) return [3 /*break*/, 1];
                    name_1 = target.name;
                    variable = this.lookupVariable(name_1);
                    if (variable) {
                        variable.value = val;
                        if (variable.isReference && typeof val === 'string') {
                            variable.referencedId = val;
                        }
                    }
                    else {
                        // Declare implicitly (python style)
                        this.declareVariable(name_1, val, 'any');
                    }
                    return [3 /*break*/, 8];
                case 1:
                    if (!(target.type === 'PointerDeref')) return [3 /*break*/, 3];
                    return [5 /*yield**/, __values(this.evaluateExpression(target.pointerExpr, funcs))];
                case 2:
                    addr = _a.sent();
                    if (typeof addr === 'string') {
                        stackVarName = this.addrToVarName.get(addr);
                        if (stackVarName) {
                            variable = this.lookupVariable(stackVarName);
                            if (variable)
                                variable.value = val;
                        }
                        else if (this.heap.has(addr)) {
                            heapObj = this.heap.get(addr);
                            heapObj.value = val;
                        }
                    }
                    return [3 /*break*/, 8];
                case 3:
                    if (!(target.type === 'ArrayAccess')) return [3 /*break*/, 6];
                    return [5 /*yield**/, __values(this.getHeapAddress(target.arrayExpr, funcs))];
                case 4:
                    arrAddr = _a.sent();
                    return [5 /*yield**/, __values(this.evaluateExpression(target.indexExpr, funcs))];
                case 5:
                    index = _a.sent();
                    if (arrAddr && this.heap.has(arrAddr)) {
                        heapObj = this.heap.get(arrAddr);
                        if (Array.isArray(heapObj.value)) {
                            heapObj.value[index] = val;
                        }
                    }
                    return [3 /*break*/, 8];
                case 6:
                    if (!(target.type === 'MemberAccess')) return [3 /*break*/, 8];
                    return [5 /*yield**/, __values(this.getHeapAddress(target.objectExpr, funcs))];
                case 7:
                    objAddr = _a.sent();
                    if (objAddr && this.heap.has(objAddr)) {
                        heapObj = this.heap.get(objAddr);
                        if (heapObj.value && typeof heapObj.value === 'object') {
                            heapObj.value[target.property] = val;
                        }
                    }
                    _a.label = 8;
                case 8: return [2 /*return*/];
            }
        });
    };
    ASTInterpreter.prototype.lookupVariable = function (name) {
        // Traverse stack frames from inner to outer
        for (var i = this.stack.length - 1; i >= 0; i--) {
            var frame = this.stack[i];
            if (frame.parameters[name]) {
                return frame.parameters[name];
            }
        }
        return this.globals.get(name);
    };
    ASTInterpreter.prototype.evaluateExpression = function (expr, funcs) {
        var activeFuncs, _a, variable, left, right, _b, val, val, val, val, val, val, val, val, val, addr, addr, varName, v, els, _i, _c, e, _d, _e, heapId, size, els, heapId_1, heapId, arrAddr, index, heapObj, objAddr, heapObj, objAddr, evaluatedObj, heapObj, argVal, argVal, argVal, parsed, argVal, parsed, heapId, argVal, heapObj, funcDecl, args, _f, _g, a, _h, _j, result;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    activeFuncs = funcs || new Map();
                    _a = expr.type;
                    switch (_a) {
                        case 'Literal': return [3 /*break*/, 1];
                        case 'Identifier': return [3 /*break*/, 2];
                        case 'BinaryOp': return [3 /*break*/, 3];
                        case 'AddressOf': return [3 /*break*/, 42];
                        case 'PointerDeref': return [3 /*break*/, 43];
                        case 'ArrayLiteral': return [3 /*break*/, 45];
                        case 'NewInstance': return [3 /*break*/, 50];
                        case 'ArrayAccess': return [3 /*break*/, 53];
                        case 'MemberAccess': return [3 /*break*/, 56];
                        case 'FunctionCall': return [3 /*break*/, 58];
                    }
                    return [3 /*break*/, 77];
                case 1: return [2 /*return*/, expr.value];
                case 2:
                    {
                        variable = this.lookupVariable(expr.name);
                        return [2 /*return*/, variable ? variable.value : null];
                    }
                    _k.label = 3;
                case 3: return [5 /*yield**/, __values(this.evaluateExpression(expr.left, activeFuncs))];
                case 4:
                    left = _k.sent();
                    return [5 /*yield**/, __values(this.evaluateExpression(expr.right, activeFuncs))];
                case 5:
                    right = _k.sent();
                    _b = expr.operator;
                    switch (_b) {
                        case '+': return [3 /*break*/, 6];
                        case '-': return [3 /*break*/, 7];
                        case '*': return [3 /*break*/, 8];
                        case '/': return [3 /*break*/, 9];
                        case '%': return [3 /*break*/, 10];
                        case '==': return [3 /*break*/, 11];
                        case '!=': return [3 /*break*/, 12];
                        case '===': return [3 /*break*/, 13];
                        case '!==': return [3 /*break*/, 14];
                        case '<': return [3 /*break*/, 15];
                        case '>': return [3 /*break*/, 16];
                        case '<=': return [3 /*break*/, 17];
                        case '>=': return [3 /*break*/, 18];
                        case '&&': return [3 /*break*/, 19];
                        case '||': return [3 /*break*/, 20];
                        case '=': return [3 /*break*/, 21];
                        case '+=': return [3 /*break*/, 23];
                        case '-=': return [3 /*break*/, 25];
                        case '*=': return [3 /*break*/, 27];
                        case '/=': return [3 /*break*/, 29];
                        case '%=': return [3 /*break*/, 31];
                        case '++_prefix': return [3 /*break*/, 33];
                        case '--_prefix': return [3 /*break*/, 35];
                        case '++_postfix': return [3 /*break*/, 37];
                        case '--_postfix': return [3 /*break*/, 39];
                    }
                    return [3 /*break*/, 41];
                case 6:
                    {
                        if (typeof left === 'string' || typeof right === 'string') {
                            return [2 /*return*/, String(left) + String(right)];
                        }
                        return [2 /*return*/, left + right];
                    }
                    _k.label = 7;
                case 7: return [2 /*return*/, left - right];
                case 8: return [2 /*return*/, left * right];
                case 9: return [2 /*return*/, right !== 0 ? left / right : 0];
                case 10: return [2 /*return*/, left % right];
                case 11: return [2 /*return*/, left == right];
                case 12: return [2 /*return*/, left != right];
                case 13: return [2 /*return*/, left === right];
                case 14: return [2 /*return*/, left !== right];
                case 15: return [2 /*return*/, left < right];
                case 16: return [2 /*return*/, left > right];
                case 17: return [2 /*return*/, left <= right];
                case 18: return [2 /*return*/, left >= right];
                case 19: return [2 /*return*/, left && right];
                case 20: return [2 /*return*/, left || right];
                case 21: return [5 /*yield**/, __values(this.assignValue(expr.left, right, activeFuncs))];
                case 22:
                    _k.sent();
                    return [2 /*return*/, right];
                case 23:
                    val = (typeof left === 'string' || typeof right === 'string')
                        ? String(left) + String(right)
                        : left + right;
                    return [5 /*yield**/, __values(this.assignValue(expr.left, val, activeFuncs))];
                case 24:
                    _k.sent();
                    return [2 /*return*/, val];
                case 25:
                    val = left - right;
                    return [5 /*yield**/, __values(this.assignValue(expr.left, val, activeFuncs))];
                case 26:
                    _k.sent();
                    return [2 /*return*/, val];
                case 27:
                    val = left * right;
                    return [5 /*yield**/, __values(this.assignValue(expr.left, val, activeFuncs))];
                case 28:
                    _k.sent();
                    return [2 /*return*/, val];
                case 29:
                    val = right !== 0 ? left / right : 0;
                    return [5 /*yield**/, __values(this.assignValue(expr.left, val, activeFuncs))];
                case 30:
                    _k.sent();
                    return [2 /*return*/, val];
                case 31:
                    val = left % right;
                    return [5 /*yield**/, __values(this.assignValue(expr.left, val, activeFuncs))];
                case 32:
                    _k.sent();
                    return [2 /*return*/, val];
                case 33:
                    val = Number(left) + 1;
                    return [5 /*yield**/, __values(this.assignValue(expr.left, val, activeFuncs))];
                case 34:
                    _k.sent();
                    return [2 /*return*/, val];
                case 35:
                    val = Number(left) - 1;
                    return [5 /*yield**/, __values(this.assignValue(expr.left, val, activeFuncs))];
                case 36:
                    _k.sent();
                    return [2 /*return*/, val];
                case 37:
                    val = Number(left) + 1;
                    return [5 /*yield**/, __values(this.assignValue(expr.left, val, activeFuncs))];
                case 38:
                    _k.sent();
                    return [2 /*return*/, left];
                case 39:
                    val = Number(left) - 1;
                    return [5 /*yield**/, __values(this.assignValue(expr.left, val, activeFuncs))];
                case 40:
                    _k.sent();
                    return [2 /*return*/, left];
                case 41: return [2 /*return*/, 0];
                case 42:
                    {
                        addr = this.varNameToAddr.get(expr.targetName);
                        return [2 /*return*/, addr || null];
                    }
                    _k.label = 43;
                case 43: return [5 /*yield**/, __values(this.evaluateExpression(expr.pointerExpr, activeFuncs))];
                case 44:
                    addr = _k.sent();
                    if (typeof addr === 'string') {
                        varName = this.addrToVarName.get(addr);
                        if (varName) {
                            v = this.lookupVariable(varName);
                            return [2 /*return*/, v ? v.value : null];
                        }
                        if (this.heap.has(addr)) {
                            return [2 /*return*/, this.heap.get(addr).value];
                        }
                    }
                    return [2 /*return*/, null];
                case 45:
                    els = [];
                    _i = 0, _c = expr.elements;
                    _k.label = 46;
                case 46:
                    if (!(_i < _c.length)) return [3 /*break*/, 49];
                    e = _c[_i];
                    _e = (_d = els).push;
                    return [5 /*yield**/, __values(this.evaluateExpression(e, activeFuncs))];
                case 47:
                    _e.apply(_d, [_k.sent()]);
                    _k.label = 48;
                case 48:
                    _i++;
                    return [3 /*break*/, 46];
                case 49:
                    heapId = this.getNextHeapAddress();
                    this.heap.set(heapId, {
                        id: heapId,
                        type: 'array',
                        value: els
                    });
                    return [2 /*return*/, heapId];
                case 50:
                    if (!expr.className.endsWith('[]')) return [3 /*break*/, 52];
                    return [5 /*yield**/, __values(this.evaluateExpression(expr.args[0], activeFuncs))];
                case 51:
                    size = _k.sent();
                    els = new Array(size).fill(0);
                    heapId_1 = this.getNextHeapAddress();
                    this.heap.set(heapId_1, {
                        id: heapId_1,
                        type: expr.className,
                        value: els
                    });
                    return [2 /*return*/, heapId_1];
                case 52:
                    heapId = this.getNextHeapAddress();
                    this.heap.set(heapId, {
                        id: heapId,
                        type: expr.className,
                        value: {}
                    });
                    return [2 /*return*/, heapId];
                case 53: return [5 /*yield**/, __values(this.getHeapAddress(expr.arrayExpr, activeFuncs))];
                case 54:
                    arrAddr = _k.sent();
                    return [5 /*yield**/, __values(this.evaluateExpression(expr.indexExpr, activeFuncs))];
                case 55:
                    index = _k.sent();
                    if (arrAddr && this.heap.has(arrAddr)) {
                        heapObj = this.heap.get(arrAddr);
                        return [2 /*return*/, Array.isArray(heapObj.value) ? heapObj.value[index] : null];
                    }
                    return [2 /*return*/, null];
                case 56: return [5 /*yield**/, __values(this.getHeapAddress(expr.objectExpr, activeFuncs))];
                case 57:
                    objAddr = _k.sent();
                    if (objAddr && this.heap.has(objAddr)) {
                        heapObj = this.heap.get(objAddr);
                        return [2 /*return*/, heapObj.value && typeof heapObj.value === 'object'
                                ? heapObj.value[expr.property]
                                : null];
                    }
                    return [2 /*return*/, null];
                case 58:
                    objAddr = null;
                    if (!expr.objectExpr) return [3 /*break*/, 60];
                    return [5 /*yield**/, __values(this.evaluateExpression(expr.objectExpr, activeFuncs))];
                case 59:
                    evaluatedObj = _k.sent();
                    if (typeof evaluatedObj === 'string') {
                        objAddr = evaluatedObj;
                    }
                    _k.label = 60;
                case 60:
                    if (!(objAddr && (expr.name === 'append' || expr.name === 'push'))) return [3 /*break*/, 62];
                    heapObj = this.heap.get(objAddr);
                    if (!(heapObj && Array.isArray(heapObj.value))) return [3 /*break*/, 62];
                    return [5 /*yield**/, __values(this.evaluateExpression(expr.args[0], activeFuncs))];
                case 61:
                    argVal = _k.sent();
                    heapObj.value.push(argVal);
                    return [2 /*return*/, null];
                case 62:
                    if (!(expr.name === 'str' || expr.name === 'String')) return [3 /*break*/, 64];
                    return [5 /*yield**/, __values(this.evaluateExpression(expr.args[0], activeFuncs))];
                case 63:
                    argVal = _k.sent();
                    return [2 /*return*/, argVal === null || argVal === undefined ? 'null' : String(argVal)];
                case 64:
                    if (!(expr.name === 'int' || expr.name === 'parseInt')) return [3 /*break*/, 66];
                    return [5 /*yield**/, __values(this.evaluateExpression(expr.args[0], activeFuncs))];
                case 65:
                    argVal = _k.sent();
                    parsed = parseInt(String(argVal), 10);
                    return [2 /*return*/, isNaN(parsed) ? 0 : parsed];
                case 66:
                    if (!(expr.name === 'float' || expr.name === 'parseFloat')) return [3 /*break*/, 68];
                    return [5 /*yield**/, __values(this.evaluateExpression(expr.args[0], activeFuncs))];
                case 67:
                    argVal = _k.sent();
                    parsed = parseFloat(String(argVal));
                    return [2 /*return*/, isNaN(parsed) ? 0.0 : parsed];
                case 68:
                    // C memory allocation: malloc(size)
                    if (expr.name === 'malloc' || expr.name === 'realloc') {
                        heapId = this.getNextHeapAddress();
                        this.heap.set(heapId, {
                            id: heapId,
                            type: 'void*',
                            value: new Array(5).fill(0) // Default contiguous allocation block of size 5
                        });
                        return [2 /*return*/, heapId];
                    }
                    if (!(expr.name === 'len' && expr.args.length === 1)) return [3 /*break*/, 70];
                    return [5 /*yield**/, __values(this.evaluateExpression(expr.args[0], activeFuncs))];
                case 69:
                    argVal = _k.sent();
                    if (typeof argVal === 'string' && this.heap.has(argVal)) {
                        heapObj = this.heap.get(argVal);
                        if (Array.isArray(heapObj.value)) {
                            return [2 /*return*/, heapObj.value.length];
                        }
                    }
                    if (Array.isArray(argVal)) {
                        return [2 /*return*/, argVal.length];
                    }
                    if (typeof argVal === 'string') {
                        return [2 /*return*/, argVal.length];
                    }
                    return [2 /*return*/, 0];
                case 70:
                    if (!activeFuncs.has(expr.name)) return [3 /*break*/, 76];
                    funcDecl = activeFuncs.get(expr.name);
                    args = [];
                    _f = 0, _g = expr.args;
                    _k.label = 71;
                case 71:
                    if (!(_f < _g.length)) return [3 /*break*/, 74];
                    a = _g[_f];
                    _j = (_h = args).push;
                    return [5 /*yield**/, __values(this.evaluateExpression(a, activeFuncs))];
                case 72:
                    _j.apply(_h, [_k.sent()]);
                    _k.label = 73;
                case 73:
                    _f++;
                    return [3 /*break*/, 71];
                case 74: return [5 /*yield**/, __values(this.executeFunctionInline(funcDecl, args, activeFuncs))];
                case 75:
                    _k.sent();
                    result = this.returnVal;
                    this.returnVal = null;
                    this.isReturning = false;
                    return [2 /*return*/, result];
                case 76: return [2 /*return*/, null];
                case 77: return [2 /*return*/, null];
            }
        });
    };
    // Executes function calls statement-by-statement inside the main generator
    ASTInterpreter.prototype.executeFunctionInline = function (funcDecl, args, funcs) {
        var paramsObj, localNames, frame, savedReturning, _i, _a, stmt;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    paramsObj = {};
                    localNames = [];
                    funcDecl.params.forEach(function (p, idx) {
                        var val = args[idx] !== undefined ? args[idx] : null;
                        var paramVar = {
                            name: p.name,
                            value: val,
                            type: p.type,
                            scope: 'parameter',
                            isReference: p.type.includes('*') || p.type.includes('[]')
                        };
                        paramsObj[p.name] = paramVar;
                        localNames.push(p.name);
                    });
                    frame = {
                        functionName: funcDecl.name,
                        line: funcDecl.loc.line,
                        parameters: paramsObj,
                        variables: localNames
                    };
                    this.stack.push(frame);
                    // Yield a step for function entry
                    return [4 /*yield*/, this.createStep(funcDecl.loc.line, 'call', "Call function \"".concat(funcDecl.name, "\" with arguments: ").concat(args.map(function (a) { return JSON.stringify(a); }).join(', ')), funcDecl.loc)];
                case 1:
                    // Yield a step for function entry
                    _b.sent();
                    savedReturning = this.isReturning;
                    this.isReturning = false;
                    _i = 0, _a = funcDecl.body;
                    _b.label = 2;
                case 2:
                    if (!(_i < _a.length)) return [3 /*break*/, 5];
                    stmt = _a[_i];
                    if (this.isReturning)
                        return [3 /*break*/, 5];
                    return [5 /*yield**/, __values(this.executeStatement(stmt, funcs))];
                case 3:
                    _b.sent();
                    _b.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    this.stack.pop();
                    this.isReturning = savedReturning;
                    return [2 /*return*/];
            }
        });
    };
    ASTInterpreter.prototype.createStep = function (line, operation, description, loc) {
        this.stepCount++;
        // Perform deep clones of active state to prevent references mutating past steps
        var clonedGlobals = Array.from(this.globals.values()).map(function (v) { return (__assign({}, v)); });
        var clonedStack = this.stack.map(function (f) {
            var clonedParams = {};
            for (var _i = 0, _a = Object.keys(f.parameters); _i < _a.length; _i++) {
                var k = _a[_i];
                clonedParams[k] = __assign({}, f.parameters[k]);
            }
            return {
                functionName: f.functionName,
                line: f.line,
                parameters: clonedParams,
                variables: __spreadArray([], f.variables, true)
            };
        });
        var clonedHeap = Array.from(this.heap.values()).map(function (h) { return ({
            id: h.id,
            type: h.type,
            value: Array.isArray(h.value) ? __spreadArray([], h.value, true) : (h.value && typeof h.value === 'object' ? __assign({}, h.value) : h.value)
        }); });
        // Gather all active frame parameters + globals into variables array for visualizer variables panel
        var currentFrame = clonedStack[clonedStack.length - 1];
        var variables = [];
        // Add globals
        clonedGlobals.forEach(function (g) { return variables.push(g); });
        // Add local variables of current frame
        if (currentFrame) {
            for (var _i = 0, _a = Object.keys(currentFrame.parameters); _i < _a.length; _i++) {
                var k = _a[_i];
                variables.push(currentFrame.parameters[k]);
            }
        }
        return {
            stepNumber: this.stepCount,
            lineNumber: line,
            columnStart: loc === null || loc === void 0 ? void 0 : loc.columnStart,
            columnEnd: loc === null || loc === void 0 ? void 0 : loc.columnEnd,
            operation: operation,
            description: description,
            variables: variables,
            callStack: clonedStack,
            heap: clonedHeap,
            stdout: this.stdout
        };
    };
    ASTInterpreter.prototype.exprToString = function (expr) {
        switch (expr.type) {
            case 'Literal': return JSON.stringify(expr.value);
            case 'Identifier': return expr.name;
            case 'BinaryOp': {
                if (expr.operator.endsWith('_prefix')) {
                    return "".concat(expr.operator.replace('_prefix', '')).concat(this.exprToString(expr.left));
                }
                if (expr.operator.endsWith('_postfix')) {
                    return "".concat(this.exprToString(expr.left)).concat(expr.operator.replace('_postfix', ''));
                }
                return "".concat(this.exprToString(expr.left), " ").concat(expr.operator, " ").concat(this.exprToString(expr.right));
            }
            case 'AddressOf': return "&".concat(expr.targetName);
            case 'PointerDeref': return "*".concat(this.exprToString(expr.pointerExpr));
            case 'ArrayAccess': return "".concat(this.exprToString(expr.arrayExpr), "[").concat(this.exprToString(expr.indexExpr), "]");
            case 'MemberAccess': return "".concat(this.exprToString(expr.objectExpr), ".").concat(expr.property);
            case 'FunctionCall': return "".concat(expr.name, "(...)");
            case 'ArrayLiteral': return "[...]";
            case 'NewInstance': return "new ".concat(expr.className, "(...)");
            default: return '';
        }
    };
    ASTInterpreter.prototype.unescapeString = function (str) {
        var result = '';
        var i = 0;
        while (i < str.length) {
            var char = str[i];
            if (char === '\\' && i + 1 < str.length) {
                var nextChar = str[i + 1];
                if (nextChar === 'n')
                    result += '\n';
                else if (nextChar === 't')
                    result += '\t';
                else if (nextChar === '\\')
                    result += '\\';
                else if (nextChar === '"')
                    result += '"';
                else if (nextChar === "'")
                    result += "'";
                else
                    result += '\\' + nextChar;
                i += 2;
            }
            else {
                result += char;
                i++;
            }
        }
        return result;
    };
    ASTInterpreter.prototype.formatPrintf = function (formatStr, args) {
        var result = '';
        var argIndex = 0;
        var i = 0;
        while (i < formatStr.length) {
            var char = formatStr[i];
            if (char === '%' && i + 1 < formatStr.length) {
                var specifier = '';
                var nextIdx = i + 1;
                while (nextIdx < formatStr.length && /[0-9.-]/.test(formatStr[nextIdx])) {
                    specifier += formatStr[nextIdx];
                    nextIdx++;
                }
                if (nextIdx < formatStr.length) {
                    var typeChar = formatStr[nextIdx];
                    specifier += typeChar;
                    nextIdx++;
                    if (argIndex < args.length) {
                        var val = args[argIndex++];
                        if (typeChar === 'd' || typeChar === 'i') {
                            result += String(Math.floor(Number(val)));
                        }
                        else if (typeChar === 'f') {
                            if (specifier.startsWith('.')) {
                                var precision = parseInt(specifier.substring(1, specifier.length - 1), 10);
                                if (!isNaN(precision)) {
                                    result += Number(val).toFixed(precision);
                                }
                                else {
                                    result += String(Number(val));
                                }
                            }
                            else {
                                result += String(Number(val));
                            }
                        }
                        else if (typeChar === 's') {
                            result += val === null || val === undefined ? 'null' : String(val);
                        }
                        else if (typeChar === 'c') {
                            result += typeof val === 'string' ? val[0] : String.fromCharCode(Number(val));
                        }
                        else {
                            result += '%' + specifier;
                        }
                    }
                    else {
                        result += '%' + specifier;
                    }
                    i = nextIdx;
                }
                else {
                    result += '%';
                    i++;
                }
            }
            else if (char === '\\' && i + 1 < formatStr.length) {
                var nextChar = formatStr[i + 1];
                if (nextChar === 'n')
                    result += '\n';
                else if (nextChar === 't')
                    result += '\t';
                else if (nextChar === '\\')
                    result += '\\';
                else if (nextChar === '"')
                    result += '"';
                else
                    result += '\\' + nextChar;
                i += 2;
            }
            else {
                result += char;
                i++;
            }
        }
        return result;
    };
    ASTInterpreter.prototype.getHeapAddress = function (expr, funcs) {
        var val, addr, parentAddr, heapObj, val, parentAddr, index, heapObj, val;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(expr.type === 'Identifier')) return [3 /*break*/, 2];
                    return [5 /*yield**/, __values(this.evaluateExpression(expr, funcs))];
                case 1:
                    val = _a.sent();
                    return [2 /*return*/, typeof val === 'string' ? val : null];
                case 2:
                    if (!(expr.type === 'PointerDeref')) return [3 /*break*/, 4];
                    return [5 /*yield**/, __values(this.evaluateExpression(expr.pointerExpr, funcs))];
                case 3:
                    addr = _a.sent();
                    return [2 /*return*/, typeof addr === 'string' ? addr : null];
                case 4:
                    if (!(expr.type === 'MemberAccess')) return [3 /*break*/, 6];
                    return [5 /*yield**/, __values(this.getHeapAddress(expr.objectExpr, funcs))];
                case 5:
                    parentAddr = _a.sent();
                    if (parentAddr && this.heap.has(parentAddr)) {
                        heapObj = this.heap.get(parentAddr);
                        if (heapObj.value && typeof heapObj.value === 'object') {
                            val = heapObj.value[expr.property];
                            return [2 /*return*/, typeof val === 'string' ? val : null];
                        }
                    }
                    _a.label = 6;
                case 6:
                    if (!(expr.type === 'ArrayAccess')) return [3 /*break*/, 9];
                    return [5 /*yield**/, __values(this.getHeapAddress(expr.arrayExpr, funcs))];
                case 7:
                    parentAddr = _a.sent();
                    return [5 /*yield**/, __values(this.evaluateExpression(expr.indexExpr, funcs))];
                case 8:
                    index = _a.sent();
                    if (parentAddr && this.heap.has(parentAddr)) {
                        heapObj = this.heap.get(parentAddr);
                        if (Array.isArray(heapObj.value)) {
                            val = heapObj.value[index];
                            return [2 /*return*/, typeof val === 'string' ? val : null];
                        }
                    }
                    _a.label = 9;
                case 9: return [2 /*return*/, null];
            }
        });
    };
    return ASTInterpreter;
}());
exports.ASTInterpreter = ASTInterpreter;
