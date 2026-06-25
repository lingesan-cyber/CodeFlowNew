import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ASTInterpreter } from './src/engine/interpreter';
import { ExecutionStep } from './src/engine/types';

interface TestCase {
  id: string;
  category: string;
  language: 'python' | 'javascript' | 'java' | 'c' | 'cpp';
  code: string;
  mockInputs?: string[];
  expectFail?: boolean;
}

const testCases: TestCase[] = [
  // ================= VARIABLES =================
  {
    id: "VAR_PYTHON",
    category: "Variables",
    language: "python",
    code: `x = 10\nx = 20\nprint(x)`
  },
  {
    id: "VAR_JS",
    category: "Variables",
    language: "javascript",
    code: `let x = 10;\nx = 20;\nconsole.log(x);`
  },
  {
    id: "VAR_JAVA",
    category: "Variables",
    language: "java",
    code: `public class Main {\n  public static void main(String[] args) {\n    int x = 10;\n    x = 20;\n    System.out.println(x);\n  }\n}`
  },
  {
    id: "VAR_C",
    category: "Variables",
    language: "c",
    code: `#include <stdio.h>\nint main() {\n  int x = 10;\n  x = 20;\n  printf("%d\\n", x);\n  return 0;\n}`
  },
  {
    id: "VAR_CPP",
    category: "Variables",
    language: "cpp",
    code: `#include <iostream>\nint main() {\n  int x = 10;\n  x = 20;\n  std::cout << x << std::endl;\n  return 0;\n}`
  },

  // ================= ARITHMETIC =================
  {
    id: "ARITH_PYTHON",
    category: "Arithmetic",
    language: "python",
    code: `a = 10\nb = 3\nprint(a + b)\nprint(a - b)\nprint(a * b)\nprint(12 % 5)`
  },
  {
    id: "ARITH_JS",
    category: "Arithmetic",
    language: "javascript",
    code: `let a = 10;\nlet b = 3;\nconsole.log(a + b);\nconsole.log(a - b);\nconsole.log(a * b);\nconsole.log(12 % 5);`
  },
  {
    id: "ARITH_JAVA",
    category: "Arithmetic",
    language: "java",
    code: `public class Main {\n  public static void main(String[] args) {\n    int a = 10;\n    int b = 3;\n    System.out.println(a + b);\n    System.out.println(a - b);\n    System.out.println(a * b);\n    System.out.println(12 % 5);\n  }\n}`
  },
  {
    id: "ARITH_C",
    category: "Arithmetic",
    language: "c",
    code: `#include <stdio.h>\nint main() {\n  int a = 10;\n  int b = 3;\n  printf("%d\\n", a + b);\n  printf("%d\\n", a - b);\n  printf("%d\\n", a * b);\n  printf("%d\\n", 12 % 5);\n  return 0;\n}`
  },
  {
    id: "ARITH_CPP",
    category: "Arithmetic",
    language: "cpp",
    code: `#include <iostream>\nint main() {\n  int a = 10;\n  int b = 3;\n  std::cout << a + b << "\\n";\n  std::cout << a - b << "\\n";\n  std::cout << a * b << "\\n";\n  std::cout << 12 % 5 << "\\n";\n  return 0;\n}`
  },

  // ================= IF ELSE =================
  {
    id: "IF_PYTHON",
    category: "If Else",
    language: "python",
    code: `x = 15\nif x > 20:\n    print(1)\nelif x > 10:\n    print(2)\nelse:\n    print(3)`
  },
  {
    id: "IF_JS",
    category: "If Else",
    language: "javascript",
    code: `let x = 15;\nif (x > 20) {\n    console.log(1);\n} else if (x > 10) {\n    console.log(2);\n} else {\n    console.log(3);\n}`
  },
  {
    id: "IF_JAVA",
    category: "If Else",
    language: "java",
    code: `public class Main {\n  public static void main(String[] args) {\n    int x = 15;\n    if (x > 20) {\n        System.out.println(1);\n    } else if (x > 10) {\n        System.out.println(2);\n    } else {\n        System.out.println(3);\n    }\n  }\n}`
  },
  {
    id: "IF_C",
    category: "If Else",
    language: "c",
    code: `#include <stdio.h>\nint main() {\n  int x = 15;\n  if (x > 20) {\n      printf("1\\n");\n  } else if (x > 10) {\n      printf("2\\n");\n  } else {\n      printf("3\\n");\n  }\n  return 0;\n}`
  },
  {
    id: "IF_CPP",
    category: "If Else",
    language: "cpp",
    code: `#include <iostream>\nint main() {\n  int x = 15;\n  if (x > 20) {\n      std::cout << 1 << "\\n";\n  } else if (x > 10) {\n      std::cout << 2 << "\\n";\n  } else {\n      std::cout << 3 << "\\n";\n  }\n  return 0;\n}`
  },

  // ================= LOOPS =================
  {
    id: "LOOP_PYTHON",
    category: "Loops",
    language: "python",
    code: `for i in range(5):\n    print(i)`
  },
  {
    id: "LOOP_JS",
    category: "Loops",
    language: "javascript",
    code: `for (let i = 0; i < 5; i++) {\n    console.log(i);\n}`
  },
  {
    id: "LOOP_JAVA",
    category: "Loops",
    language: "java",
    code: `public class Main {\n  public static void main(String[] args) {\n    for (int i = 0; i < 5; i++) {\n        System.out.println(i);\n    }\n  }\n}`
  },
  {
    id: "LOOP_C",
    category: "Loops",
    language: "c",
    code: `#include <stdio.h>\nint main() {\n  int i;\n  for (i = 0; i < 5; i++) {\n      printf("%d\\n", i);\n  }\n  return 0;\n}`
  },
  {
    id: "LOOP_CPP",
    category: "Loops",
    language: "cpp",
    code: `#include <iostream>\nint main() {\n  for (int i = 0; i < 5; i++) {\n      std::cout << i << "\\n";\n  }\n  return 0;\n}`
  },
  // Critically request iteration test case
  {
    id: "LOOP_ITER_PYTHON",
    category: "Loops",
    language: "python",
    code: `arr = [10, 20, 30, 40, 50]\ntotal = 0\nfor x in arr:\n    total += x\nprint(total)`
  },

  // ================= NESTED LOOPS =================
  {
    id: "NESTED_PYTHON",
    category: "Nested Loops",
    language: "python",
    code: `for i in range(2):\n    for j in range(3):\n        print(i, j)`
  },
  {
    id: "NESTED_JS",
    category: "Nested Loops",
    language: "javascript",
    code: `for (let i = 0; i < 2; i++) {\n    for (let j = 0; j < 3; j++) {\n        console.log(i, j);\n    }\n}`
  },
  {
    id: "NESTED_JAVA",
    category: "Nested Loops",
    language: "java",
    code: `public class Main {\n  public static void main(String[] args) {\n    for (int i = 0; i < 2; i++) {\n        for (int j = 0; j < 3; j++) {\n            System.out.println(i + " " + j);\n        }\n    }\n  }\n}`
  },
  {
    id: "NESTED_C",
    category: "Nested Loops",
    language: "c",
    code: `#include <stdio.h>\nint main() {\n  int i; int j;\n  for (i = 0; i < 2; i++) {\n      for (j = 0; j < 3; j++) {\n          printf("%d %d\\n", i, j);\n      }\n  }\n  return 0;\n}`
  },
  {
    id: "NESTED_CPP",
    category: "Nested Loops",
    language: "cpp",
    code: `#include <iostream>\nint main() {\n  int i; int j;\n  for (i = 0; i < 2; i++) {\n      for (j = 0; j < 3; j++) {\n          std::cout << i << " " << j << "\\n";\n      }\n  }\n  return 0;\n}`
  },

  // ================= ARRAYS =================
  {
    id: "ARRAY_PYTHON",
    category: "Arrays",
    language: "python",
    code: `arr = [10, 20, 30]\nprint(arr[0])\narr[1] = 50\nprint(arr[1])`
  },
  {
    id: "ARRAY_JS",
    category: "Arrays",
    language: "javascript",
    code: `let arr = [10, 20, 30];\nconsole.log(arr[0]);\narr[1] = 50;\nconsole.log(arr[1]);`
  },
  {
    id: "ARRAY_JAVA",
    category: "Arrays",
    language: "java",
    code: `public class Main {\n  public static void main(String[] args) {\n    int arr[] = new int[3];\n    arr[0] = 10;\n    arr[1] = 20;\n    System.out.println(arr[0]);\n    arr[1] = 50;\n    System.out.println(arr[1]);\n  }\n}`
  },
  {
    id: "ARRAY_C",
    category: "Arrays",
    language: "c",
    code: `#include <stdio.h>\nint main() {\n  int arr[3] = {10, 20, 30};\n  printf("%d\\n", arr[0]);\n  arr[1] = 50;\n  printf("%d\\n", arr[1]);\n  return 0;\n}`
  },
  {
    id: "ARRAY_CPP",
    category: "Arrays",
    language: "cpp",
    code: `#include <iostream>\nint main() {\n  int arr[3] = {10, 20, 30};\n  std::cout << arr[0] << "\\n";\n  arr[1] = 50;\n  std::cout << arr[1] << "\\n";\n  return 0;\n}`
  },

  // ================= STRINGS =================
  {
    id: "STRING_PYTHON",
    category: "Strings",
    language: "python",
    code: `s1 = "hello"\ns2 = "world"\nprint(s1 + s2)`
  },
  {
    id: "STRING_JS",
    category: "Strings",
    language: "javascript",
    code: `let s1 = "hello";\nlet s2 = "world";\nconsole.log(s1 + s2);`
  },
  {
    id: "STRING_JAVA",
    category: "Strings",
    language: "java",
    code: `public class Main {\n  public static void main(String[] args) {\n    String s1 = "hello";\n    String s2 = "world";\n    System.out.println(s1 + s2);\n  }\n}`
  },
  {
    id: "STRING_C",
    category: "Strings",
    language: "c",
    code: `#include <stdio.h>\nint main() {\n  char* s1 = "hello";\n  char* s2 = "world";\n  printf("%s%s\\n", s1, s2);\n  return 0;\n}`
  },
  {
    id: "STRING_CPP",
    category: "Strings",
    language: "cpp",
    code: `#include <iostream>\n#include <string>\nint main() {\n  std::string s1 = "hello";\n  std::string s2 = "world";\n  std::cout << s1 + s2 << std::endl;\n  return 0;\n}`
  },

  // ================= FUNCTIONS =================
  {
    id: "FUNC_PYTHON",
    category: "Functions",
    language: "python",
    code: `def add(x, y):\n    return x + y\nres = add(5, 7)\nprint(res)`
  },
  {
    id: "FUNC_JS",
    category: "Functions",
    language: "javascript",
    code: `function add(x, y) {\n    return x + y;\n}\nlet res = add(5, 7);\nconsole.log(res);`
  },
  {
    id: "FUNC_JAVA",
    category: "Functions",
    language: "java",
    code: `public class Main {\n  public static int add(int x, int y) {\n    return x + y;\n  }\n  public static void main(String[] args) {\n    int res = add(5, 7);\n    System.out.println(res);\n  }\n}`
  },
  {
    id: "FUNC_C",
    category: "Functions",
    language: "c",
    code: `#include <stdio.h>\nint add(int x, int y) {\n  return x + y;\n}\nint main() {\n  int res = add(5, 7);\n  printf("%d\\n", res);\n  return 0;\n}`
  },
  {
    id: "FUNC_CPP",
    category: "Functions",
    language: "cpp",
    code: `#include <iostream>\nint add(int x, int y) {\n  return x + y;\n}\nint main() {\n  int res = add(5, 7);\n  std::cout << res << std::endl;\n  return 0;\n}`
  },

  // ================= RECURSION =================
  {
    id: "REC_PYTHON",
    category: "Recursion",
    language: "python",
    code: `def fib(n):\n    if n <= 1:\n        return n\n    return fib(n-1) + fib(n-2)\nprint(fib(5))`
  },
  {
    id: "REC_JS",
    category: "Recursion",
    language: "javascript",
    code: `function fib(n) {\n    if (n <= 1) {\n        return n;\n    }\n    return fib(n-1) + fib(n-2);\n}\nconsole.log(fib(5));`
  },
  {
    id: "REC_JAVA",
    category: "Recursion",
    language: "java",
    code: `public class Main {\n  public static int fib(int n) {\n    if (n <= 1) {\n        return n;\n    }\n    return fib(n-1) + fib(n-2);\n  }\n  public static void main(String[] args) {\n    System.out.println(fib(5));\n  }\n}`
  },
  {
    id: "REC_C",
    category: "Recursion",
    language: "c",
    code: `#include <stdio.h>\nint fib(int n) {\n  if (n <= 1) {\n      return n;\n  }\n  return fib(n-1) + fib(n-2);\n}\nint main() {\n  printf("%d\\n", fib(5));\n  return 0;\n}`
  },
  {
    id: "REC_CPP",
    category: "Recursion",
    language: "cpp",
    code: `#include <iostream>\nint fib(int n) {\n  if (n <= 1) {\n      return n;\n  }\n  return fib(n-1) + fib(n-2);\n}\nint main() {\n  std::cout << fib(5) << std::endl;\n  return 0;\n}`
  },

  // ================= OBJECTS =================
  {
    id: "OBJ_PYTHON",
    category: "Objects",
    language: "python",
    code: `# Simulate object variable binding\nx = 10\nprint(x)`
  },
  {
    id: "OBJ_JS",
    category: "Objects",
    language: "javascript",
    code: `function Item() {}\nlet item = new Item();\nitem.val = 42;\nconsole.log(item.val);`
  },
  {
    id: "OBJ_JAVA",
    category: "Objects",
    language: "java",
    code: `public class Main {\n  int val;\n  public static void main(String[] args) {\n    Main m = new Main();\n    m.val = 42;\n    System.out.println(m.val);\n  }\n}`
  },
  {
    id: "OBJ_C",
    category: "Objects",
    language: "c",
    code: `#include <stdio.h>\n#include <stdlib.h>\nstruct Node {\n  int val;\n};\nint main() {\n  struct Node *n = malloc(5);\n  n->val = 42;\n  printf("%d\\n", n->val);\n  return 0;\n}`
  },
  {
    id: "OBJ_CPP",
    category: "Objects",
    language: "cpp",
    code: `#include <iostream>\nstruct Node {\n  int val;\n};\nint main() {\n  struct Node *n = new Node();\n  n->val = 42;\n  std::cout << n->val << std::endl;\n  return 0;\n}`
  },

  // ================= POINTERS =================
  {
    id: "PTR_PYTHON",
    category: "Pointers",
    language: "python",
    code: `x = [10]\ny = x\ny[0] = 20\nprint(x[0])`
  },
  {
    id: "PTR_JS",
    category: "Pointers",
    language: "javascript",
    code: `function Item() {}\nlet x = new Item();\nx.val = 10;\nlet y = x;\ny.val = 20;\nconsole.log(x.val);`
  },
  {
    id: "PTR_JAVA",
    category: "Pointers",
    language: "java",
    code: `public class Main {\n  int val;\n  public static void main(String[] args) {\n    Main x = new Main();\n    x.val = 10;\n    Main y = x;\n    y.val = 20;\n    System.out.println(x.val);\n  }\n}`
  },
  {
    id: "PTR_C",
    category: "Pointers",
    language: "c",
    code: `#include <stdio.h>\nint main() {\n  int x = 10;\n  int *p = &x;\n  *p = 20;\n  printf("%d\\n", x);\n  return 0;\n}`
  },
  {
    id: "PTR_CPP",
    category: "Pointers",
    language: "cpp",
    code: `#include <iostream>\nint main() {\n  int x = 10;\n  int *p = &x;\n  *p = 20;\n  std::cout << x << std::endl;\n  return 0;\n}`
  },

  // ================= DYNAMIC MEMORY =================
  {
    id: "DYN_PYTHON",
    category: "Dynamic Memory",
    language: "python",
    code: `arr = [0, 0, 0, 0, 0]\narr[0] = 100\nprint(arr[0])`
  },
  {
    id: "DYN_JS",
    category: "Dynamic Memory",
    language: "javascript",
    code: `let arr = [0, 0, 0, 0, 0];\narr[0] = 100;\nconsole.log(arr[0]);`
  },
  {
    id: "DYN_JAVA",
    category: "Dynamic Memory",
    language: "java",
    code: `public class Main {\n  public static void main(String[] args) {\n    int arr[] = new int[5];\n    arr[0] = 100;\n    System.out.println(arr[0]);\n  }\n}`
  },
  {
    id: "DYN_C",
    category: "Dynamic Memory",
    language: "c",
    code: `#include <stdio.h>\n#include <stdlib.h>\nint main() {\n  int *p = malloc(5);\n  p[0] = 100;\n  printf("%d\\n", p[0]);\n  free(p);\n  return 0;\n}`
  },
  {
    id: "DYN_CPP",
    category: "Dynamic Memory",
    language: "cpp",
    code: `#include <iostream>\nint main() {\n  int *p = new int[5];\n  p[0] = 100;\n  std::cout << p[0] << std::endl;\n  delete[] p;\n  return 0;\n}`
  },

  // ================= INPUT =================
  {
    id: "IN_PYTHON",
    category: "Input",
    language: "python",
    code: `x = int(input())\nprint(x + 5)`,
    mockInputs: ["10"]
  },
  {
    id: "IN_JS",
    category: "Input",
    language: "javascript",
    code: `x = prompt();\nconsole.log(x);`,
    mockInputs: ["10"]
  },
  {
    id: "IN_JAVA",
    category: "Input",
    language: "java",
    code: `import java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    int x = sc.nextInt();\n    System.out.println(x + 5);\n  }\n}`,
    mockInputs: ["10"]
  },
  {
    id: "IN_C",
    category: "Input",
    language: "c",
    code: `#include <stdio.h>\nint main() {\n  int x;\n  scanf("%d", &x);\n  printf("%d\\n", x + 5);\n  return 0;\n}`,
    mockInputs: ["10"]
  },
  {
    id: "IN_CPP",
    category: "Input",
    language: "cpp",
    code: `#include <iostream>\nint main() {\n  int x;\n  std::cin >> x;\n  std::cout << x + 5 << std::endl;\n  return 0;\n}`,
    mockInputs: ["10"]
  },

  // ================= OUTPUT =================
  {
    id: "OUT_PYTHON",
    category: "Output",
    language: "python",
    code: `print("hello")`
  },
  {
    id: "OUT_JS",
    category: "Output",
    language: "javascript",
    code: `console.log("hello");`
  },
  {
    id: "OUT_JAVA",
    category: "Output",
    language: "java",
    code: `public class Main {\n  public static void main(String[] args) {\n    System.out.println("hello");\n  }\n}`
  },
  {
    id: "OUT_C",
    category: "Output",
    language: "c",
    code: `#include <stdio.h>\nint main() {\n  printf("hello\\n");\n  return 0;\n}`
  },
  {
    id: "OUT_CPP",
    category: "Output",
    language: "cpp",
    code: `#include <iostream>\nint main() {\n  std::cout << "hello" << std::endl;\n  return 0;\n}`
  },

  // ================= ALGORITHMS =================
  {
    id: "ALG_PYTHON",
    category: "Algorithms",
    language: "python",
    code: `arr = [3, 1, 2]\nif arr[0] > arr[1]:\n    t = arr[0]\n    arr[0] = arr[1]\n    arr[1] = t\nif arr[1] > arr[2]:\n    t = arr[1]\n    arr[1] = arr[2]\n    arr[2] = t\nif arr[0] > arr[1]:\n    t = arr[0]\n    arr[0] = arr[1]\n    arr[1] = t\nprint(arr[0], arr[1], arr[2])`
  },
  {
    id: "ALG_JS",
    category: "Algorithms",
    language: "javascript",
    code: `let arr = [3, 1, 2];\nif (arr[0] > arr[1]) {\n    let t = arr[0];\n    arr[0] = arr[1];\n    arr[1] = t;\n}\nif (arr[1] > arr[2]) {\n    let t = arr[1];\n    arr[1] = arr[2];\n    arr[2] = t;\n}\nif (arr[0] > arr[1]) {\n    let t = arr[0];\n    arr[0] = arr[1];\n    arr[1] = t;\n}\nconsole.log(arr[0], arr[1], arr[2]);`
  },
  {
    id: "ALG_JAVA",
    category: "Algorithms",
    language: "java",
    code: `public class Main {\n  public static void main(String[] args) {\n    int arr[] = new int[3];\n    arr[0] = 3; arr[1] = 1; arr[2] = 2;\n    if (arr[0] > arr[1]) {\n        int t = arr[0];\n        arr[0] = arr[1];\n        arr[1] = t;\n    }\n    if (arr[1] > arr[2]) {\n        int t = arr[1];\n        arr[1] = arr[2];\n        arr[2] = t;\n    }\n    if (arr[0] > arr[1]) {\n        int t = arr[0];\n        arr[0] = arr[1];\n        arr[1] = t;\n    }\n    System.out.println(arr[0] + " " + arr[1] + " " + arr[2]);\n  }\n}`
  },
  {
    id: "ALG_C",
    category: "Algorithms",
    language: "c",
    code: `#include <stdio.h>\nint main() {\n  int arr[3] = {3, 1, 2};\n  if (arr[0] > arr[1]) {\n      int t = arr[0];\n      arr[0] = arr[1];\n      arr[1] = t;\n  }\n  if (arr[1] > arr[2]) {\n      int t = arr[1];\n      arr[1] = arr[2];\n      arr[2] = t;\n  }\n  if (arr[0] > arr[1]) {\n      int t = arr[0];\n      arr[0] = arr[1];\n      arr[1] = t;\n  }\n  printf("%d %d %d\\n", arr[0], arr[1], arr[2]);\n  return 0;\n}`
  },
  {
    id: "ALG_CPP",
    category: "Algorithms",
    language: "cpp",
    code: `#include <iostream>\nint main() {\n  int arr[3] = {3, 1, 2};\n  if (arr[0] > arr[1]) {\n      int t = arr[0];\n      arr[0] = arr[1];\n      arr[1] = t;\n  }\n  if (arr[1] > arr[2]) {\n      int t = arr[1];\n      arr[1] = arr[2];\n      arr[2] = t;\n  }\n  if (arr[0] > arr[1]) {\n      int t = arr[0];\n      arr[0] = arr[1];\n      arr[1] = t;\n  }\n  std::cout << arr[0] << " " << arr[1] << " " << arr[2] << std::endl;\n  return 0;\n}`
  },

  // ================= DATA STRUCTURES =================
  {
    id: "DS_PYTHON",
    category: "Data Structures",
    language: "python",
    code: `node2 = [20, None]\nnode1 = [10, node2]\nprint(node1[0], node1[1][0])`
  },
  {
    id: "DS_JS",
    category: "Data Structures",
    language: "javascript",
    code: `function Node() {}\nlet n1 = new Node();\nlet n2 = new Node();\nn1.val = 10;\nn2.val = 20;\nn1.next = n2;\nconsole.log(n1.val, n1.next.val);`
  },
  {
    id: "DS_JAVA",
    category: "Data Structures",
    language: "java",
    code: `public class Main {\n  int val;\n  Main next;\n  public static void main(String[] args) {\n    Main n1 = new Main();\n    Main n2 = new Main();\n    n1.val = 10;\n    n2.val = 20;\n    n1.next = n2;\n    System.out.println(n1.val + " " + n1.next.val);\n  }\n}`
  },
  {
    id: "DS_C",
    category: "Data Structures",
    language: "c",
    code: `#include <stdio.h>\n#include <stdlib.h>\nstruct Node {\n  int val;\n  struct Node *next;\n};\nint main() {\n  struct Node *n1 = malloc(5);\n  struct Node *n2 = malloc(5);\n  n1->val = 10;\n  n2->val = 20;\n  n1->next = n2;\n  printf("%d %d\\n", n1->val, n1->next->val);\n  return 0;\n}`
  },
  {
    id: "DS_CPP",
    category: "Data Structures",
    language: "cpp",
    code: `#include <iostream>\nstruct Node {\n  int val;\n  struct Node *next;\n};\nint main() {\n  struct Node *n1 = new Node();\n  struct Node *n2 = new Node();\n  n1->val = 10;\n  n2->val = 20;\n  n1->next = n2;\n  std::cout << n1->val << " " << n1->next->val << std::endl;\n  return 0;\n}`
  },

  // ================= EDGE CASES =================
  {
    id: "EDGE_PYTHON",
    category: "Edge Cases",
    language: "python",
    code: `x = 0\nfor i in range(0):\n    x = x + 1\nprint(x)`
  },
  {
    id: "EDGE_JS",
    category: "Edge Cases",
    language: "javascript",
    code: `let x = 0;\nfor (let i = 0; i < 0; i++) {\n    x = x + 1;\n}\nconsole.log(x);`
  },
  {
    id: "EDGE_JAVA",
    category: "Edge Cases",
    language: "java",
    code: `public class Main {\n  public static void main(String[] args) {\n    int x = 0;\n    for (int i = 0; i < 0; i++) {\n        x = x + 1;\n    }\n    System.out.println(x);\n  }\n}`
  },
  {
    id: "EDGE_C",
    category: "Edge Cases",
    language: "c",
    code: `#include <stdio.h>\nint main() {\n  int x = 0;\n  int i;\n  for (i = 0; i < 0; i++) {\n      x = x + 1;\n  }\n  printf("%d\\n", x);\n  return 0;\n}`
  },
  {
    id: "EDGE_CPP",
    category: "Edge Cases",
    language: "cpp",
    code: `#include <iostream>\nint main() {\n  int x = 0;\n  for (int i = 0; i < 0; i++) {\n      x = x + 1;\n  }\n  std::cout << x << std::endl;\n  return 0;\n}`
  },

  // ================= ERROR HANDLING =================
  {
    id: "ERR_PYTHON",
    category: "Error Handling",
    language: "python",
    code: `if True`,
    expectFail: true
  },
  {
    id: "ERR_JS",
    category: "Error Handling",
    language: "javascript",
    code: `let x =;`,
    expectFail: true
  },
  {
    id: "ERR_JAVA",
    category: "Error Handling",
    language: "java",
    code: `public class Main {`,
    expectFail: true
  },
  {
    id: "ERR_C",
    category: "Error Handling",
    language: "c",
    code: `int main() { return`,
    expectFail: true
  },
  {
    id: "ERR_CPP",
    category: "Error Handling",
    language: "cpp",
    code: `int main() { std::cout << ; }`,
    expectFail: true
  }
];

function cleanOutput(out: string): string {
  return out.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function runRealRuntime(tc: TestCase): { success: boolean; stdout: string; errorMsg?: string } {
  const tempDir = path.join(__dirname, 'temp_verify');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  const stdinInput = tc.mockInputs ? tc.mockInputs.join('\n') : '';

  try {
    if (tc.language === 'python') {
      const filePath = path.join(tempDir, `${tc.id}.py`);
      fs.writeFileSync(filePath, tc.code);
      const out = execSync(`python "${filePath}"`, { input: stdinInput }).toString();
      return { success: true, stdout: cleanOutput(out) };
    } 
    else if (tc.language === 'javascript') {
      const filePath = path.join(tempDir, `${tc.id}.js`);
      let codeToRun = tc.code;
      // Prepend mock prompt definition for JS real runtime if it is the Input test case
      if (tc.id === 'IN_JS') {
        codeToRun = `globalThis.prompt = () => "10";\n` + codeToRun;
      }
      fs.writeFileSync(filePath, codeToRun);
      const out = execSync(`node "${filePath}"`, { input: stdinInput }).toString();
      return { success: true, stdout: cleanOutput(out) };
    } 
    else if (tc.language === 'java') {
      const filePath = path.join(tempDir, 'Main.java');
      fs.writeFileSync(filePath, tc.code);
      // Compile
      execSync(`javac "${filePath}"`);
      const out = execSync(`java -cp "${tempDir}" Main`, { input: stdinInput }).toString();
      return { success: true, stdout: cleanOutput(out) };
    } 
    else if (tc.language === 'c') {
      const filePath = path.join(tempDir, `${tc.id}.c`);
      const exePath = path.join(tempDir, `${tc.id}.exe`);
      fs.writeFileSync(filePath, tc.code);
      // Compile
      execSync(`gcc -o "${exePath}" "${filePath}"`);
      const out = execSync(`"${exePath}"`, { input: stdinInput }).toString();
      return { success: true, stdout: cleanOutput(out) };
    } 
    else if (tc.language === 'cpp') {
      const filePath = path.join(tempDir, `${tc.id}.cpp`);
      const exePath = path.join(tempDir, `${tc.id}.exe`);
      fs.writeFileSync(filePath, tc.code);
      // Compile
      execSync(`g++ -o "${exePath}" "${filePath}"`);
      const out = execSync(`"${exePath}"`, { input: stdinInput }).toString();
      return { success: true, stdout: cleanOutput(out) };
    }
  } catch (err: any) {
    return { success: false, stdout: '', errorMsg: err.message || String(err) };
  } finally {
    // Cleanup temporary files
    try {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
    } catch {}
  }

  return { success: false, stdout: '', errorMsg: 'Unknown language' };
}

function runInterpreter(tc: TestCase): { success: boolean; stdout: string; errorMsg?: string } {
  try {
    const interpreter = new ASTInterpreter(tc.code, tc.language);
    const stepsGen = interpreter.run();
    const steps: ExecutionStep[] = [];
    let inputIdx = 0;
    
    let res = stepsGen.next();
    while (!res.done) {
      const step = res.value;
      steps.push(step);
      
      // Extract diagnostics for loop steps
      if (step.operation === 'loop_start') {
        console.log(`   [DIAGNOSTIC] Loop start checked at line ${step.lineNumber}: ${step.description}`);
        
        // Find loop iterator details dynamically
        const idxVar = step.variables.find(v => v.name.startsWith('_iter_idx_'));
        if (idxVar) {
          const match = idxVar.name.match(/_iter_idx_([a-zA-Z0-9_]+)_(\d+)/);
          if (match) {
            const loopVarName = match[1];
            const line = match[2];
            
            const idxVal = idxVar.value;
            const objVar = step.variables.find(v => v.name === `_iter_obj_${loopVarName}_${line}`);
            const loopVar = step.variables.find(v => v.name === loopVarName);
            
            let arrayLength = 0;
            if (objVar && typeof objVar.value === 'string') {
              const heapObj = step.heap.find(h => h.id === objVar.value);
              if (heapObj && Array.isArray(heapObj.value)) {
                arrayLength = heapObj.value.length;
              }
            }

            console.log(`   [DIAGNOSTIC] Loop state: Var="${loopVarName}" Index=${idxVal} ArrayLength=${arrayLength} CurrentValue=${loopVar ? JSON.stringify(loopVar.value) : 'null'}`);
          }
        }

        if (step.description.includes('-> false')) {
          console.log(`   [DIAGNOSTIC] Loop exit condition reached: ${step.description}`);
        }
      }

      if (step.awaitingInput) {
        const fedInput = tc.mockInputs && tc.mockInputs[inputIdx] !== undefined ? tc.mockInputs[inputIdx] : '';
        inputIdx++;
        res = stepsGen.next(fedInput);
      } else {
        res = stepsGen.next();
      }
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

async function startVerification() {
  console.log("====================================================");
  console.log("   CODEFLOW EXECUTION ENGINE CERTIFICATION SUITE   ");
  console.log("====================================================\n");

  const results: { tc: TestCase; pass: boolean; realOut: string; interpOut: string; reason?: string }[] = [];

  for (const tc of testCases) {
    console.log(`Running [${tc.language.toUpperCase()}] [${tc.category}] - ${tc.id}...`);

    const real = runRealRuntime(tc);
    const interp = runInterpreter(tc);

    let pass = false;
    let reason = '';

    if (tc.expectFail) {
      // For expected failures, both should fail (either compilation or runtime crash)
      const realFailed = !real.success;
      const interpFailed = !interp.success;
      pass = realFailed && interpFailed;
      if (pass) {
        reason = `Both failed as expected (Real error: ${real.errorMsg?.substring(0, 40)}, Interpreter error: ${interp.errorMsg})`;
      } else {
        reason = `Mismatched failure: Real success=${real.success}, Interpreter success=${interp.success}`;
      }
    } else {
      if (!real.success) {
        reason = `Real runtime failed to run: ${real.errorMsg}`;
      } else if (!interp.success) {
        reason = `Interpreter failed to run: ${interp.errorMsg}`;
      } else {
        const outMatch = real.stdout === interp.stdout;
        pass = outMatch;
        if (!pass) {
          reason = `Stdout mismatch.\nReal stdout:\n"${real.stdout}"\nInterpreter stdout:\n"${interp.stdout}"`;
        }
      }
    }

    results.push({
      tc,
      pass,
      realOut: real.success ? real.stdout : `[FAIL: ${real.errorMsg}]`,
      interpOut: interp.success ? interp.stdout : `[FAIL: ${interp.errorMsg}]`,
      reason
    });
  }

  // Print results summary
  console.log("\n====================================================");
  console.log("                  DETAILED RESULTS                  ");
  console.log("====================================================");

  let passedCount = 0;
  const languageScores: Record<string, { pass: number; total: number }> = {
    python: { pass: 0, total: 0 },
    javascript: { pass: 0, total: 0 },
    java: { pass: 0, total: 0 },
    c: { pass: 0, total: 0 },
    cpp: { pass: 0, total: 0 }
  };

  for (const res of results) {
    const status = res.pass ? "✅ PASS" : "❌ FAIL";
    if (res.pass) {
      passedCount++;
      languageScores[res.tc.language].pass++;
    }
    languageScores[res.tc.language].total++;

    console.log(`[${res.tc.language.toUpperCase()}] ${res.tc.category} (${res.tc.id}): ${status}`);
    if (!res.pass) {
      console.log(`   Reason: ${res.reason?.replace(/\n/g, '\n   ')}`);
    }
  }

  console.log("\n====================================================");
  console.log("               CERTIFICATION SUMMARY                ");
  console.log("====================================================");
  console.log(`Overall Progress: ${passedCount} / ${testCases.length} Passed\n`);
  
  for (const lang of Object.keys(languageScores)) {
    const score = languageScores[lang];
    const status = score.pass === score.total ? "CERTIFIED" : "FAILED";
    console.log(`${lang.toUpperCase().padEnd(12)}: ${score.pass} / ${score.total} Passed [${status}]`);
  }
  console.log("====================================================");
}

startVerification();
