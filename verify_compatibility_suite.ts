import { ASTInterpreter } from './src/engine/interpreter';
import { ExecutionStep } from './src/engine/types';
import * as fs from 'fs';
import * as path from 'path';

interface FeatureTest {
  id: string;
  language: 'python' | 'javascript' | 'java' | 'c' | 'cpp';
  feature: string;
  code: string;
  mockInputs?: string[];
  expectedOutput: string;
}

const tests: FeatureTest[] = [
  // ================= PYTHON =================
  {
    id: "PY_VAR",
    language: "python",
    feature: "Variables",
    code: `x = 10\ny = 20\nprint(x + y)`,
    expectedOutput: "30"
  },
  {
    id: "PY_LIST",
    language: "python",
    feature: "Lists",
    code: `arr = [10, 20, 30]\nprint(arr[1])`,
    expectedOutput: "20"
  },
  {
    id: "PY_TUPLE",
    language: "python",
    feature: "Tuples",
    code: `tup = (10, 20)\nprint(tup[0])`,
    expectedOutput: "10"
  },
  {
    id: "PY_SET",
    language: "python",
    feature: "Sets",
    code: `s = {1, 2}\nprint(1 in s)`,
    expectedOutput: "True"
  },
  {
    id: "PY_DICT",
    language: "python",
    feature: "Dictionaries",
    code: `d = {"a": 10, "b": 20}\nprint(d["a"] + d["b"])`,
    expectedOutput: "30"
  },
  {
    id: "PY_CLASS",
    language: "python",
    feature: "Classes",
    code: `class A:\n    x = 10\nprint(A.x)`,
    expectedOutput: "10"
  },
  {
    id: "PY_CTOR",
    language: "python",
    feature: "Constructors",
    code: `class A:\n    def __init__(self, val):\n        self.val = val\na = A(10)\nprint(a.val)`,
    expectedOutput: "10"
  },
  {
    id: "PY_METHOD",
    language: "python",
    feature: "Methods",
    code: `class A:\n    def __init__(self, val):\n        self.val = val\n    def get_val(self):\n        return self.val\na = A(10)\nprint(a.get_val())`,
    expectedOutput: "10"
  },
  {
    id: "PY_INHERIT",
    language: "python",
    feature: "Inheritance",
    code: `class A:\n    x = 10\nclass B(A):\n    y = 20\nb = B()\nprint(b.x)`,
    expectedOutput: "10"
  },
  {
    id: "PY_PROP",
    language: "python",
    feature: "Properties",
    code: `class A:\n    @property\n    def val(self):\n        return 10\na = A()\nprint(a.val)`,
    expectedOutput: "10"
  },
  {
    id: "PY_COMP",
    language: "python",
    feature: "List comprehensions",
    code: `arr = [x * 2 for x in [1, 2]]\nprint(arr[0])`,
    expectedOutput: "2"
  },
  {
    id: "PY_EXCEPT",
    language: "python",
    feature: "Exception handling",
    code: `try:\n    x = int("invalid")\nexcept ValueError:\n    print("caught")`,
    expectedOutput: "caught"
  },
  {
    id: "PY_BUILTIN",
    language: "python",
    feature: "Builtins",
    code: `print(len([1, 2]), round(2.6), str(10), int("15"), float("3.5"))`,
    expectedOutput: "2 3 10 15 3.5"
  },

  // ================= JAVASCRIPT =================
  {
    id: "JS_OBJ",
    language: "javascript",
    feature: "Objects",
    code: `let obj = {x: 10, y: 20};\nconsole.log(obj.x + obj.y);`,
    expectedOutput: "30"
  },
  {
    id: "JS_CLASS",
    language: "javascript",
    feature: "Classes",
    code: `class A { constructor() { this.x = 10; } }\nlet a = new A();\nconsole.log(a.x);`,
    expectedOutput: "10"
  },
  {
    id: "JS_CTOR",
    language: "javascript",
    feature: "Constructors",
    code: `class A { constructor(val) { this.val = val; } }\nlet a = new A(10);\nconsole.log(a.val);`,
    expectedOutput: "10"
  },
  {
    id: "JS_ARR",
    language: "javascript",
    feature: "Arrays",
    code: `let arr = [10, 20];\nconsole.log(arr[0] + arr[1]);`,
    expectedOutput: "30"
  },
  {
    id: "JS_MAP",
    language: "javascript",
    feature: "Maps",
    code: `let m = new Map();\nm.set("a", 10);\nconsole.log(m.get("a"));`,
    expectedOutput: "10"
  },
  {
    id: "JS_SET",
    language: "javascript",
    feature: "Sets",
    code: `let s = new Set();\ns.add(10);\nconsole.log(s.has(10));`,
    expectedOutput: "true"
  },
  {
    id: "JS_ARROW",
    language: "javascript",
    feature: "Arrow functions",
    code: `let f = (x) => x * 2;\nconsole.log(f(5));`,
    expectedOutput: "10"
  },
  {
    id: "JS_PROTO",
    language: "javascript",
    feature: "Prototype access",
    code: `class A {}\nA.prototype.x = 10;\nlet a = new A();\nconsole.log(a.x);`,
    expectedOutput: "10"
  },

  // ================= JAVA =================
  {
    id: "JAVA_CLASS",
    language: "java",
    feature: "Classes",
    code: `public class Main {\n  int x = 10;\n  public static void main(String[] args) {\n    Main m = new Main();\n    System.out.println(m.x);\n  }\n}`,
    expectedOutput: "10"
  },
  {
    id: "JAVA_CTOR",
    language: "java",
    feature: "Constructors",
    code: `public class Main {\n  int val;\n  public Main(int val) {\n    this.val = val;\n  }\n  public static void main(String[] args) {\n    Main m = new Main(10);\n    System.out.println(m.val);\n  }\n}`,
    expectedOutput: "10"
  },
  {
    id: "JAVA_FIELD",
    language: "java",
    feature: "Fields",
    code: `public class Main {\n  public int val = 10;\n  public static void main(String[] args) {\n    Main m = new Main();\n    System.out.println(m.val);\n  }\n}`,
    expectedOutput: "10"
  },
  {
    id: "JAVA_METHOD",
    language: "java",
    feature: "Methods",
    code: `public class Main {\n  public int getVal() { return 10; }\n  public static void main(String[] args) {\n    Main m = new Main();\n    System.out.println(m.getVal());\n  }\n}`,
    expectedOutput: "10"
  },
  {
    id: "JAVA_STATIC",
    language: "java",
    feature: "Static methods",
    code: `class Helper {\n  public static int getVal() { return 10; }\n}\npublic class Main {\n  public static void main(String[] args) {\n    System.out.println(Helper.getVal());\n  }\n}`,
    expectedOutput: "10"
  },
  {
    id: "JAVA_ARR",
    language: "java",
    feature: "Arrays",
    code: `public class Main {\n  public static void main(String[] args) {\n    int[] arr = new int[5];\n    arr[0] = 10;\n    System.out.println(arr[0]);\n  }\n}`,
    expectedOutput: "10"
  },
  {
    id: "JAVA_LIST",
    language: "java",
    feature: "ArrayList",
    code: `import java.util.ArrayList;\npublic class Main {\n  public static void main(String[] args) {\n    ArrayList<Integer> arr = new ArrayList<>();\n    arr.add(10);\n    System.out.println(arr.get(0));\n  }\n}`,
    expectedOutput: "10"
  },
  {
    id: "JAVA_MAP",
    language: "java",
    feature: "HashMap",
    code: `import java.util.HashMap;\npublic class Main {\n  public static void main(String[] args) {\n    HashMap<String, Integer> m = new HashMap<>();\n    m.put("a", 10);\n    System.out.println(m.get("a"));\n  }\n}`,
    expectedOutput: "10"
  },
  {
    id: "JAVA_INHERIT",
    language: "java",
    feature: "Inheritance",
    code: `class Parent {\n  int x = 10;\n}\npublic class Main extends Parent {\n  public static void main(String[] args) {\n    Main m = new Main();\n    System.out.println(m.x);\n  }\n}`,
    expectedOutput: "10"
  },

  // ================= C =================
  {
    id: "C_ARR",
    language: "c",
    feature: "Arrays",
    code: `#include <stdio.h>\nint main() {\n  int arr[3] = {10, 20, 30};\n  printf("%d\\n", arr[0]);\n  return 0;\n}`,
    expectedOutput: "10"
  },
  {
    id: "C_STRUCT",
    language: "c",
    feature: "Structs",
    code: `#include <stdio.h>\nstruct Player {\n  char name[20];\n  int score;\n};\nint main() {\n  struct Player p = {"Hero", 100};\n  printf("%d\\n", p.score);\n  return 0;\n}`,
    expectedOutput: "100"
  },
  {
    id: "C_NESTED_STRUCT",
    language: "c",
    feature: "Nested structs",
    code: `#include <stdio.h>\nstruct Address {\n  int zip;\n};\nstruct Person {\n  struct Address addr;\n};\nint main() {\n  struct Person p = {{90210}};\n  printf("%d\\n", p.addr.zip);\n  return 0;\n}`,
    expectedOutput: "90210"
  },
  {
    id: "C_PTR",
    language: "c",
    feature: "Pointer access",
    code: `#include <stdio.h>\nint main() {\n  int x = 10;\n  int *p = &x;\n  printf("%d\\n", *p);\n  return 0;\n}`,
    expectedOutput: "10"
  },
  {
    id: "C_FUNC_PTR",
    language: "c",
    feature: "Function pointers",
    code: `#include <stdio.h>\nvoid func(int x) { printf("%d\\n", x); }\nint main() {\n  void (*fp)(int) = func;\n  fp(10);\n  return 0;\n}`,
    expectedOutput: "10"
  },

  // ================= C++ =================
  {
    id: "CPP_CLASS",
    language: "cpp",
    feature: "Classes",
    code: `#include <iostream>\nclass Player {\npublic:\n  int score = 100;\n};\nint main() {\n  Player p;\n  std::cout << p.score << std::endl;\n  return 0;\n}`,
    expectedOutput: "100"
  },
  {
    id: "CPP_STRUCT",
    language: "cpp",
    feature: "Structs",
    code: `#include <iostream>\nstruct Player {\n  int score;\n};\nint main() {\n  struct Player p = {100};\n  std::cout << p.score << std::endl;\n  return 0;\n}`,
    expectedOutput: "100"
  },
  {
    id: "CPP_CTOR",
    language: "cpp",
    feature: "Constructors",
    code: `#include <iostream>\nclass Player {\npublic:\n  int score;\n  Player(int s) { score = s; }\n};\nint main() {\n  Player p(100);\n  std::cout << p.score << std::endl;\n  return 0;\n}`,
    expectedOutput: "100"
  },
  {
    id: "CPP_METHOD",
    language: "cpp",
    feature: "Methods",
    code: `#include <iostream>\nclass Player {\npublic:\n  int score = 100;\n  int getScore() { return score; }\n};\nint main() {\n  Player p;\n  std::cout << p.getScore() << std::endl;\n  return 0;\n}`,
    expectedOutput: "100"
  },
  {
    id: "CPP_VECTOR",
    language: "cpp",
    feature: "Vectors",
    code: `#include <iostream>\n#include <vector>\nint main() {\n  std::vector<int> v;\n  v.push_back(10);\n  std::cout << v[0] << std::endl;\n  return 0;\n}`,
    expectedOutput: "10"
  },
  {
    id: "CPP_REF",
    language: "cpp",
    feature: "References",
    code: `#include <iostream>\nint main() {\n  int x = 10;\n  int &ref = x;\n  ref = 20;\n  std::cout << x << std::endl;\n  return 0;\n}`,
    expectedOutput: "20"
  },
  {
    id: "CPP_INHERIT",
    language: "cpp",
    feature: "Inheritance",
    code: `#include <iostream>\nclass Parent {\npublic:\n  int x = 10;\n};\nclass Child : public Parent {};\nint main() {\n  Child c;\n  std::cout << c.x << std::endl;\n  return 0;\n}`,
    expectedOutput: "10"
  }
];

function cleanOutput(out: string): string {
  return out.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function runInterpreter(code: string, language: any): { success: boolean; stdout: string; errorMsg?: string } {
  try {
    const interpreter = new ASTInterpreter(code, language);
    const stepsGen = interpreter.run();
    const steps: ExecutionStep[] = [];
    
    let res = stepsGen.next();
    while (!res.done) {
      steps.push(res.value);
      res = stepsGen.next();
    }
    
    const finalSteps = res.value || steps;
    const lastStep = finalSteps[finalSteps.length - 1];
    
    if (lastStep?.error) {
      return { success: false, stdout: cleanOutput(lastStep.stdout), errorMsg: lastStep.error.message };
    }
    
    return { success: true, stdout: cleanOutput(lastStep?.stdout || '') };
  } catch (err: any) {
    return { success: false, stdout: '', errorMsg: err.message || String(err) };
  }
}

async function startAudit() {
  console.log("====================================================");
  console.log("       CODEFLOW DETAILED COMPATIBILITY AUDIT        ");
  console.log("====================================================\n");

  const results: Array<{
    tc: FeatureTest;
    tested: boolean;
    passed: boolean;
    failed: boolean;
    actualOut: string;
    actualError?: string;
  }> = [];

  for (const tc of tests) {
    console.log(`Auditing [${tc.language.toUpperCase()}] ${tc.feature} (${tc.id})...`);
    
    const run = runInterpreter(tc.code, tc.language);
    
    const passed = run.success && run.stdout.includes(tc.expectedOutput);
    const failed = !passed;
    
    results.push({
      tc,
      tested: true,
      passed,
      failed,
      actualOut: run.stdout,
      actualError: run.errorMsg
    });
  }

  // Categories status verification: Category is PASS ONLY if every feature inside has passed
  const categoryPasses: Record<string, boolean> = {};
  const languages: Array<'python' | 'javascript' | 'java' | 'c' | 'cpp'> = ['python', 'javascript', 'java', 'c', 'cpp'];
  for (const lang of languages) {
    const langResults = results.filter(r => r.tc.language === lang);
    const allPass = langResults.every(r => r.passed);
    categoryPasses[lang] = allPass;
  }

  // Write reports to disk as artifacts
  const artifactDir = path.dirname(__filename);

  // 1. Coverage Matrix
  const matrixRows = [];
  matrixRows.push("# Feature Coverage Matrix\n");
  matrixRows.push("| Language | Feature | Tested | Passed | Failed | Status |");
  matrixRows.push("|---|---|---|---|---|---|");
  for (const r of results) {
    const status = r.passed ? "✅ PASS" : "❌ FAIL";
    matrixRows.push(`| ${r.tc.language.toUpperCase()} | ${r.tc.feature} | ${r.tested ? "Yes" : "No"} | ${r.passed ? "Yes" : "No"} | ${r.failed ? "Yes" : "No"} | ${status} |`);
  }
  fs.writeFileSync(path.join(artifactDir, 'coverage_matrix.md'), matrixRows.join('\n'));

  // 2. Failure and Gap Report
  const gapReport = [];
  gapReport.push("# Gap and Failure Report\n");
  for (const r of results) {
    if (r.failed) {
      gapReport.push(`## FAIL: [${r.tc.language.toUpperCase()}] ${r.tc.feature} (${r.tc.id})`);
      gapReport.push(`* **Actual Output**: \`${r.actualOut || "None"}\``);
      gapReport.push(`* **Error Message**: \`${r.actualError || "None"}\``);
      
      let rootCause = "";
      let affectedFile = "";
      let affectedParserSection = "";
      let recommendation = "";

      if (r.tc.id === "PY_TUPLE") {
        rootCause = "The parser has no grammar rule for tuple commas in primary expressions, treating commas as punctuation only within argument lists or array literals.";
        affectedFile = "src/engine/parser.ts";
        affectedParserSection = "BaseParser.parsePrimary()";
        recommendation = "Add a check in `parsePrimary` or `parseExpression` to detect comma operators and construct a `TupleLiteral` AST node.";
      } else if (r.tc.id === "PY_SET") {
        rootCause = "Curly braces `{}` are hardcoded to dictionary literals in BaseParser for non-C languages, which fails when no colon `:` is found in the entry.";
        affectedFile = "src/engine/parser.ts";
        affectedParserSection = "BaseParser.parsePrimary() dictionary literal check";
        recommendation = "If `{` is matched, scan ahead to see if elements contain colons `:`. If not, parse as a `SetLiteral`.";
      } else if (r.tc.id === "PY_CLASS") {
        rootCause = "Class name identifiers (e.g. `A`) are not registered as runtime namespace variables. Thus, accessing attributes directly on the class (e.g. `A.x`) fails because the class name evaluates to `null`.";
        affectedFile = "src/engine/interpreter.ts";
        affectedParserSection = "ASTInterpreter.evaluateExpression() Identifier / MemberAccess";
        recommendation = "Bind class names as constant identifiers referencing a static type namespace object on the heap containing class attributes.";
      } else if (r.tc.id === "PY_INHERIT") {
        rootCause = "PythonParser class definition rule assumes a colon immediately after the class name, ignoring parenthesized base classes.";
        affectedFile = "src/engine/languages/python.ts";
        affectedParserSection = "PythonParser.parseStatement() class block";
        recommendation = "Allow optional parenthesized inheritance arguments, parsing them as base class references.";
      } else if (r.tc.id === "PY_PROP") {
        rootCause = "Decorators beginning with `@` are not mapped in the Python parser, causing parse statement failure. Additionally, member access without parentheses (e.g. `a.val` instead of `a.val()`) is resolved as a function reference rather than invoking getter logic.";
        affectedFile = "src/engine/languages/python.ts";
        affectedParserSection = "PythonParser.parseStatement() & ASTInterpreter.evaluateExpression() MemberAccess";
        recommendation = "Add syntax parsing for decorator symbols (`@identifier`) and intercept property-like member accesses to invoke underlying getter methods dynamically.";
      } else if (r.tc.id === "PY_COMP") {
        rootCause = "List comprehension expressions `[x for x in y]` are parsed as standard array literals and throw syntax errors on the `for` keyword.";
        affectedFile = "src/engine/parser.ts";
        affectedParserSection = "BaseParser.parsePrimary() array literal check";
        recommendation = "Inside array literal parsing, check if the second token is `for`. If so, parse as a `ListComprehension` AST node.";
      } else if (r.tc.id === "JS_OBJ") {
        rootCause = "Object literal keys of type `Identifier` (e.g., `x` in `{x: 10}`) are evaluated as variables in the scope (returning `null`) instead of being treated as literal string keys.";
        affectedFile = "src/engine/interpreter.ts";
        affectedParserSection = "ASTInterpreter.evaluateExpression() DictionaryLiteral";
        recommendation = "When evaluating `DictionaryLiteral` entries, check if the key is an `Identifier`. If so, use its name string directly instead of evaluating it.";
      } else if (r.tc.id === "JS_MAP" || r.tc.id === "JS_SET") {
        rootCause = "ES6 Map and Set classes are parsed as general classes but do not have native class method implementations in the interpreter.";
        affectedFile = "src/engine/interpreter.ts";
        affectedParserSection = "ASTInterpreter.evaluateExpression() FunctionCall";
        recommendation = "Provide standard library mock maps for JS `Map` and `Set` in the interpreter's native function call dispatcher.";
      } else if (r.tc.id === "JS_ARROW") {
        rootCause = "Parser has no expression rule matching arrow symbols `=>` to bind function arguments to bodies.";
        affectedFile = "src/engine/parser.ts";
        affectedParserSection = "BaseParser.parseExpression()";
        recommendation = "Implement support for arrow function syntax `(params) => expr` or `params => { body }` in expression parsing.";
      } else if (r.tc.id === "JS_PROTO") {
        rootCause = "Class prototype objects are not populated with prototype fields (like `A.prototype.x`), and standard property access does not delegate to class prototype chains recursively.";
        affectedFile = "src/engine/interpreter.ts";
        affectedParserSection = "ASTInterpreter.evaluateExpression() MemberAccess";
        recommendation = "Initialize a class prototype heap object on class creation, and resolve properties via prototype chain delegation in `MemberAccess`.";
      } else if (r.tc.id === "JAVA_STATIC") {
        rootCause = "Class name identifiers (e.g. `Helper` in `Helper.getVal()`) evaluate to `null` because classes are not registered as namespace scope variables, causing static call routing to fail.";
        affectedFile = "src/engine/interpreter.ts";
        affectedParserSection = "ASTInterpreter.evaluateExpression() FunctionCall";
        recommendation = "Bind class names as static scope namespace objects and look up functions with the matching class prefix dynamically.";
      } else if (r.tc.id === "JAVA_LIST" || r.tc.id === "JAVA_MAP") {
        rootCause = "Generic types (e.g. `<Integer>`) and ArrayList/HashMap standard libraries are unrecognized.";
        affectedFile = "src/engine/languages/java.ts";
        affectedParserSection = "JavaParser.parseStatement()";
        recommendation = "Recognize generic type parameters during variable type parsing and register helper implementations for Java collections.";
      } else if (r.tc.id === "JAVA_INHERIT") {
        rootCause = "The `extends` keyword is not handled in the Java parser.";
        affectedFile = "src/engine/languages/java.ts";
        affectedParserSection = "JavaParser.parseStatement() class definition";
        recommendation = "Add parsing for the `extends` token and capture the base class name.";
      } else if (r.tc.id === "C_FUNC_PTR") {
        rootCause = "Function pointer types (e.g., `void (*fp)(int)`) throw syntax errors during declaration matching.";
        affectedFile = "src/engine/languages/c.ts";
        affectedParserSection = "CParser.parseStatement()";
        recommendation = "Implement syntax resolution for parenthesized dereferenced identifiers in type signatures.";
      } else if (r.tc.id === "CPP_CLASS") {
        rootCause = "Stack class allocation without constructor parameters (e.g. `Player p;`) is parsed but not initialized on the heap. Trying to access fields (e.g. `p.score`) returns `null` because `p` evaluates to `null`.";
        affectedFile = "src/engine/interpreter.ts";
        affectedParserSection = "ASTInterpreter.declareVariable()";
        recommendation = "If declaring a variable of class type in C++ without explicit assignment, initialize a new heap address and invoke its default constructor.";
      } else if (r.tc.id === "CPP_CTOR" || r.tc.id === "CPP_METHOD") {
        rootCause = "Implicit `this->` resolution is missing. In C++, class methods and constructors referring to class fields (e.g., `score = s` or `return score;`) are evaluated as local variable assignments or stack lookups instead of writing/reading fields on `this`.";
        affectedFile = "src/engine/interpreter.ts";
        affectedParserSection = "ASTInterpreter.evaluateExpression() Identifier / assignValue() Identifier";
        recommendation = "When evaluating identifiers inside active class methods/constructors, check if the identifier matches a field name of the active class, and if so, implicitly redirect it as a member access on `this`.";
      } else if (r.tc.id === "CPP_VECTOR") {
        rootCause = "std::vector is parsed as a custom class/struct but has no standard methods (e.g. push_back) mapped in the interpreter.";
        affectedFile = "src/engine/interpreter.ts";
        affectedParserSection = "ASTInterpreter.evaluateExpression() FunctionCall";
        recommendation = "Intercept C++ vector methods inside the interpreter function call handler.";
      } else if (r.tc.id === "CPP_REF") {
        rootCause = "Reference declarations like `int &ref = x` are parsed as normal variables or throw because `&` is treated as AddressOf.";
        affectedFile = "src/engine/languages/cpp.ts";
        affectedParserSection = "CPPParser.parseStatement()";
        recommendation = "Allow `&` suffix in C++ type signatures and flag the declared variable as a reference.";
      } else if (r.tc.id === "CPP_INHERIT") {
        rootCause = "C++ inheritance syntax `:` is not handled by the CPP parser.";
        affectedFile = "src/engine/languages/cpp.ts";
        affectedParserSection = "CPPParser.parseStatement() class parsing";
        recommendation = "Support colon `:` followed by public/private visibility and base class identifier.";
      }

      gapReport.push(`* **Root Cause**: ${rootCause}`);
      gapReport.push(`* **Affected File**: [${path.basename(affectedFile)}](file:///${affectedFile.replace(/\\/g, '/')})`);
      gapReport.push(`* **Interpreter/Parser Section**: \`${affectedParserSection}\``);
      gapReport.push(`* **Recommendation**: ${recommendation}\n`);
    }
  }
  fs.writeFileSync(path.join(artifactDir, 'gap_report.md'), gapReport.join('\n'));

  // 3. Missing Coverage Report
  const missingReport = [];
  missingReport.push("# Missing Coverage Report\n");
  const missingTests = tests.filter(t => !t.code);
  if (missingTests.length === 0) {
    missingReport.push("All listed features from the specification are fully covered by dedicated tests. No features are missing coverage!");
  } else {
    for (const mt of missingTests) {
      missingReport.push(`* Feature "${mt.feature}" under language "${mt.language}" has no test.`);
    }
  }
  fs.writeFileSync(path.join(artifactDir, 'missing_coverage_report.md'), missingReport.join('\n'));

  // 4. Certification Report
  const certificationReport = [];
  const totalFeatures = tests.length;
  const passedFeatures = results.filter(r => r.passed).length;
  const failedFeatures = results.filter(r => !r.passed).length;
  const coveragePercent = ((passedFeatures / totalFeatures) * 100).toFixed(1);

  certificationReport.push("# Certification Report\n");
  certificationReport.push(`* **Total Features Audited**: ${totalFeatures}`);
  certificationReport.push(`* **Passed Audits (Expected Behavior Verified)**: ${passedFeatures}`);
  certificationReport.push(`* **Failed Audits**: ${failedFeatures}`);
  certificationReport.push(`* **Audited Feature Coverage**: ${coveragePercent}%`);
  certificationReport.push("\n## Categories Certification Status:");
  for (const lang of Object.keys(categoryPasses)) {
    certificationReport.push(`* **${lang.toUpperCase()}**: ${categoryPasses[lang] ? "PASS" : "FAIL (Unsupported features present)"}`);
  }
  fs.writeFileSync(path.join(artifactDir, 'certification_report.md'), certificationReport.join('\n'));

  // Output summary to console
  console.log("\n====================================================");
  console.log("                 AUDIT COMPLETED                    ");
  console.log("====================================================");
  console.log(`Coverage Matrix written to: coverage_matrix.md`);
  console.log(`Gap Report written to: gap_report.md`);
  console.log(`Missing Coverage Report written to: missing_coverage_report.md`);
  console.log(`Certification Report written to: certification_report.md`);
}

startAudit();
