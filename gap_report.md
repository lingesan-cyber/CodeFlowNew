# Gap and Failure Report

## FAIL: [PYTHON] Tuples (PY_TUPLE)
* **Actual Output**: `None`
* **Error Message**: `Expected token ")" but got "," at line 1, col 10`
* **Root Cause**: The parser has no grammar rule for tuple commas in primary expressions, treating commas as punctuation only within argument lists or array literals.
* **Affected File**: [parser.ts](file:///src/engine/parser.ts)
* **Interpreter/Parser Section**: `BaseParser.parsePrimary()`
* **Recommendation**: Add a check in `parsePrimary` or `parseExpression` to detect comma operators and construct a `TupleLiteral` AST node.

## FAIL: [PYTHON] Sets (PY_SET)
* **Actual Output**: `None`
* **Error Message**: `Expected token type OPERATOR but got PUNCTUATION (value: ",") at line 1, col 7`
* **Root Cause**: Curly braces `{}` are hardcoded to dictionary literals in BaseParser for non-C languages, which fails when no colon `:` is found in the entry.
* **Affected File**: [parser.ts](file:///src/engine/parser.ts)
* **Interpreter/Parser Section**: `BaseParser.parsePrimary() dictionary literal check`
* **Recommendation**: If `{` is matched, scan ahead to see if elements contain colons `:`. If not, parse as a `SetLiteral`.

## FAIL: [PYTHON] Classes (PY_CLASS)
* **Actual Output**: `None`
* **Error Message**: `None`
* **Root Cause**: Class name identifiers (e.g. `A`) are not registered as runtime namespace variables. Thus, accessing attributes directly on the class (e.g. `A.x`) fails because the class name evaluates to `null`.
* **Affected File**: [interpreter.ts](file:///src/engine/interpreter.ts)
* **Interpreter/Parser Section**: `ASTInterpreter.evaluateExpression() Identifier / MemberAccess`
* **Recommendation**: Bind class names as constant identifiers referencing a static type namespace object on the heap containing class attributes.

## FAIL: [PYTHON] Inheritance (PY_INHERIT)
* **Actual Output**: `None`
* **Error Message**: `Expected token type OPERATOR but got PUNCTUATION (value: "(") at line 3, col 8`
* **Root Cause**: PythonParser class definition rule assumes a colon immediately after the class name, ignoring parenthesized base classes.
* **Affected File**: [python.ts](file:///src/engine/languages/python.ts)
* **Interpreter/Parser Section**: `PythonParser.parseStatement() class block`
* **Recommendation**: Allow optional parenthesized inheritance arguments, parsing them as base class references.

## FAIL: [PYTHON] Properties (PY_PROP)
* **Actual Output**: `None`
* **Error Message**: `None`
* **Root Cause**: Decorators beginning with `@` are not mapped in the Python parser, causing parse statement failure. Additionally, member access without parentheses (e.g. `a.val` instead of `a.val()`) is resolved as a function reference rather than invoking getter logic.
* **Affected File**: [python.ts](file:///src/engine/languages/python.ts)
* **Interpreter/Parser Section**: `PythonParser.parseStatement() & ASTInterpreter.evaluateExpression() MemberAccess`
* **Recommendation**: Add syntax parsing for decorator symbols (`@identifier`) and intercept property-like member accesses to invoke underlying getter methods dynamically.

## FAIL: [PYTHON] List comprehensions (PY_COMP)
* **Actual Output**: `None`
* **Error Message**: `Unexpected token "for" of type KEYWORD at line 1, col 14`
* **Root Cause**: List comprehension expressions `[x for x in y]` are parsed as standard array literals and throw syntax errors on the `for` keyword.
* **Affected File**: [parser.ts](file:///src/engine/parser.ts)
* **Interpreter/Parser Section**: `BaseParser.parsePrimary() array literal check`
* **Recommendation**: Inside array literal parsing, check if the second token is `for`. If so, parse as a `ListComprehension` AST node.

## FAIL: [JAVASCRIPT] Objects (JS_OBJ)
* **Actual Output**: `NaN`
* **Error Message**: `None`
* **Root Cause**: Object literal keys of type `Identifier` (e.g., `x` in `{x: 10}`) are evaluated as variables in the scope (returning `null`) instead of being treated as literal string keys.
* **Affected File**: [interpreter.ts](file:///src/engine/interpreter.ts)
* **Interpreter/Parser Section**: `ASTInterpreter.evaluateExpression() DictionaryLiteral`
* **Recommendation**: When evaluating `DictionaryLiteral` entries, check if the key is an `Identifier`. If so, use its name string directly instead of evaluating it.

## FAIL: [JAVASCRIPT] Maps (JS_MAP)
* **Actual Output**: `null`
* **Error Message**: `None`
* **Root Cause**: ES6 Map and Set classes are parsed as general classes but do not have native class method implementations in the interpreter.
* **Affected File**: [interpreter.ts](file:///src/engine/interpreter.ts)
* **Interpreter/Parser Section**: `ASTInterpreter.evaluateExpression() FunctionCall`
* **Recommendation**: Provide standard library mock maps for JS `Map` and `Set` in the interpreter's native function call dispatcher.

## FAIL: [JAVASCRIPT] Sets (JS_SET)
* **Actual Output**: `null`
* **Error Message**: `None`
* **Root Cause**: ES6 Map and Set classes are parsed as general classes but do not have native class method implementations in the interpreter.
* **Affected File**: [interpreter.ts](file:///src/engine/interpreter.ts)
* **Interpreter/Parser Section**: `ASTInterpreter.evaluateExpression() FunctionCall`
* **Recommendation**: Provide standard library mock maps for JS `Map` and `Set` in the interpreter's native function call dispatcher.

## FAIL: [JAVASCRIPT] Arrow functions (JS_ARROW)
* **Actual Output**: `None`
* **Error Message**: `Unexpected token ">" of type OPERATOR at line 1, col 14`
* **Root Cause**: Parser has no expression rule matching arrow symbols `=>` to bind function arguments to bodies.
* **Affected File**: [parser.ts](file:///src/engine/parser.ts)
* **Interpreter/Parser Section**: `BaseParser.parseExpression()`
* **Recommendation**: Implement support for arrow function syntax `(params) => expr` or `params => { body }` in expression parsing.

## FAIL: [JAVASCRIPT] Prototype access (JS_PROTO)
* **Actual Output**: `null`
* **Error Message**: `None`
* **Root Cause**: Class prototype objects are not populated with prototype fields (like `A.prototype.x`), and standard property access does not delegate to class prototype chains recursively.
* **Affected File**: [interpreter.ts](file:///src/engine/interpreter.ts)
* **Interpreter/Parser Section**: `ASTInterpreter.evaluateExpression() MemberAccess`
* **Recommendation**: Initialize a class prototype heap object on class creation, and resolve properties via prototype chain delegation in `MemberAccess`.

## FAIL: [JAVA] Static methods (JAVA_STATIC)
* **Actual Output**: `null`
* **Error Message**: `None`
* **Root Cause**: Class name identifiers (e.g. `Helper` in `Helper.getVal()`) evaluate to `null` because classes are not registered as namespace scope variables, causing static call routing to fail.
* **Affected File**: [interpreter.ts](file:///src/engine/interpreter.ts)
* **Interpreter/Parser Section**: `ASTInterpreter.evaluateExpression() FunctionCall`
* **Recommendation**: Bind class names as static scope namespace objects and look up functions with the matching class prefix dynamically.

## FAIL: [JAVA] ArrayList (JAVA_LIST)
* **Actual Output**: `None`
* **Error Message**: `Expected token type PUNCTUATION but got OPERATOR (value: "<") at line 4, col 43`
* **Root Cause**: Generic types (e.g. `<Integer>`) and ArrayList/HashMap standard libraries are unrecognized.
* **Affected File**: [java.ts](file:///src/engine/languages/java.ts)
* **Interpreter/Parser Section**: `JavaParser.parseStatement()`
* **Recommendation**: Recognize generic type parameters during variable type parsing and register helper implementations for Java collections.

## FAIL: [JAVA] HashMap (JAVA_MAP)
* **Actual Output**: `None`
* **Error Message**: `Expected token ";" but got "," at line 4, col 19`
* **Root Cause**: Generic types (e.g. `<Integer>`) and ArrayList/HashMap standard libraries are unrecognized.
* **Affected File**: [java.ts](file:///src/engine/languages/java.ts)
* **Interpreter/Parser Section**: `JavaParser.parseStatement()`
* **Recommendation**: Recognize generic type parameters during variable type parsing and register helper implementations for Java collections.

## FAIL: [JAVA] Inheritance (JAVA_INHERIT)
* **Actual Output**: `None`
* **Error Message**: `Expected token type PUNCTUATION but got IDENTIFIER (value: "extends") at line 4, col 19`
* **Root Cause**: The `extends` keyword is not handled in the Java parser.
* **Affected File**: [java.ts](file:///src/engine/languages/java.ts)
* **Interpreter/Parser Section**: `JavaParser.parseStatement() class definition`
* **Recommendation**: Add parsing for the `extends` token and capture the base class name.

## FAIL: [C] Function pointers (C_FUNC_PTR)
* **Actual Output**: `None`
* **Error Message**: `Expected token type IDENTIFIER but got PUNCTUATION (value: "(") at line 4, col 8`
* **Root Cause**: Function pointer types (e.g., `void (*fp)(int)`) throw syntax errors during declaration matching.
* **Affected File**: [c.ts](file:///src/engine/languages/c.ts)
* **Interpreter/Parser Section**: `CParser.parseStatement()`
* **Recommendation**: Implement syntax resolution for parenthesized dereferenced identifiers in type signatures.

## FAIL: [CPP] Vectors (CPP_VECTOR)
* **Actual Output**: `null`
* **Error Message**: `None`
* **Root Cause**: std::vector is parsed as a custom class/struct but has no standard methods (e.g. push_back) mapped in the interpreter.
* **Affected File**: [interpreter.ts](file:///src/engine/interpreter.ts)
* **Interpreter/Parser Section**: `ASTInterpreter.evaluateExpression() FunctionCall`
* **Recommendation**: Intercept C++ vector methods inside the interpreter function call handler.

## FAIL: [CPP] References (CPP_REF)
* **Actual Output**: `None`
* **Error Message**: `Expected token type IDENTIFIER but got OPERATOR (value: "&") at line 4, col 7`
* **Root Cause**: Reference declarations like `int &ref = x` are parsed as normal variables or throw because `&` is treated as AddressOf.
* **Affected File**: [cpp.ts](file:///src/engine/languages/cpp.ts)
* **Interpreter/Parser Section**: `CPPParser.parseStatement()`
* **Recommendation**: Allow `&` suffix in C++ type signatures and flag the declared variable as a reference.

## FAIL: [CPP] Inheritance (CPP_INHERIT)
* **Actual Output**: `None`
* **Error Message**: `Expected token type PUNCTUATION but got OPERATOR (value: ":") at line 6, col 13`
* **Root Cause**: C++ inheritance syntax `:` is not handled by the CPP parser.
* **Affected File**: [cpp.ts](file:///src/engine/languages/cpp.ts)
* **Interpreter/Parser Section**: `CPPParser.parseStatement() class parsing`
* **Recommendation**: Support colon `:` followed by public/private visibility and base class identifier.
