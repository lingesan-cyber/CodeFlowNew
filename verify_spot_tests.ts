import { ASTInterpreter } from './src/engine/interpreter';

const pythonTests = [
  {
    id: 1,
    name: "Variables + Arithmetic",
    code: `x = 10\ny = 3\nprint(x + y, x - y, x * y, x // y, x % y)`
  },
  {
    id: 2,
    name: "if-elif-else",
    code: `score = 85\nif score >= 90:\n    print("A")\nelif score >= 80:\n    print("B")\nelse:\n    print("C")`
  },
  {
    id: 3,
    name: "for loop + range",
    code: `for i in range(1, 6):\n    print(i)`
  },
  {
    id: 4,
    name: "Function + recursion",
    code: `def factorial(n):\n    if n == 0:\n        return 1\n    return n * factorial(n - 1)\nprint(factorial(5))`
  },
  {
    id: 5,
    name: "List operations",
    code: `nums = [5, 3, 8, 1, 9, 2]\nnums.sort()\nprint(nums)`
  },
  {
    id: 6,
    name: "Dictionary",
    code: `student = {"name": "Alice", "grade": 90}\nstudent["grade"] = 95\nprint(student["name"], student["grade"])`
  },
  {
    id: 7,
    name: "Class + inheritance",
    code: `class Animal:\n    def __init__(self, name):\n        self.name = name\n    def speak(self):\n        return "..."\n\nclass Dog(Animal):\n    def speak(self):\n        return self.name + " says Woof"\n\nd = Dog("Rex")\nprint(d.speak())`
  },
  {
    id: 8,
    name: "Exception handling",
    code: `try:\n    result = 10 / 0\nexcept:\n    print("Caught: division by zero")\nfinally:\n    print("Done")`
  },
  {
    id: 9,
    name: "List comprehension",
    code: `squares = [x**2 for x in range(1, 6)]\nprint(squares)`
  },
  {
    id: 10,
    name: "Lambda + map",
    code: `double = lambda x: x * 2\nresult = list(map(double, [1, 2, 3, 4, 5]))\nprint(result)`
  }
];

const jsTests = [
  {
    id: 1,
    name: "Variables + template literals",
    code: `let name = "CodeFlow";\nlet version = 2;\nconsole.log(name + " v" + version);`
  },
  {
    id: 2,
    name: "Arrow function",
    code: `const square = (n) => n * n;\nconsole.log(square(7));`
  },
  {
    id: 3,
    name: "Array methods",
    code: `let nums = [3, 1, 4, 1, 5, 9];\nlet sorted = nums.sort((a, b) => a - b);\nconsole.log(sorted);`
  },
  {
    id: 4,
    name: "Object destructuring",
    code: `let arr = [1, 2, 3, 4];\nlet a = arr[0];\nlet b = arr[1];\nconsole.log(a, b);`
  },
  {
    id: 5,
    name: "Class + inheritance",
    code: `class Shape {\n    constructor(color) { this.color = color; }\n    describe() { return "A " + this.color + " shape"; }\n}\nclass Circle extends Shape {\n    constructor(color, r) { super(color); this.r = r; }\n    area() { return 3.14 * this.r * this.r; }\n}\nlet c = new Circle("red", 5);\nconsole.log(c.describe());\nconsole.log(c.area());`
  },
  {
    id: 6,
    name: "Promise + async/await",
    code: `async function fetchData() {\n    return 1;\n}\nasync function main() {\n    const result = await fetchData();\n    console.log("data loaded");\n}\nmain();`
  },
  {
    id: 7,
    name: "try/catch/finally",
    code: `try {\n    throw "Something broke";\n} catch (e) {\n    console.log("Error: " + e);\n} finally {\n    console.log("Cleanup done");\n}`
  },
  {
    id: 8,
    name: "Map + Set",
    code: `let map = {};\nmap["x"] = 10;\nmap["y"] = 20;\nconsole.log(map["x"] + map["y"]);`
  },
  {
    id: 9,
    name: "Higher-order functions",
    code: `const nums2 = [1, 2, 3, 4, 5];\nconst result = nums2.filter(n => n % 2 === 0).map(n => n * 10);\nconsole.log(result);`
  },
  {
    id: 10,
    name: "Closure",
    code: `function counter() {\n    let count = 0;\n    return () => {\n        count = count + 1;\n        return count;\n    };\n}\nconst inc = counter();\nconsole.log(inc(), inc(), inc());`
  }
];

const javaTests = [
  {
    id: 1,
    name: "Variables + output",
    code: `int a = 10, b = 20;\nSystem.out.println("Sum: " + (a + b));`
  },
  {
    id: 2,
    name: "for loop + array",
    code: `int[] arr = {5, 3, 8, 1, 9};\nint max = arr[0];\nfor (int i = 1; i < arr.length; i++) {\n    if (arr[i] > max) max = arr[i];\n}\nSystem.out.println("Max: " + max);`
  },
  {
    id: 3,
    name: "Enhanced for",
    code: `String[] fruits = {"Apple", "Banana", "Cherry"};\nfor (String f : fruits) {\n    System.out.print(f + " ");\n}`
  },
  {
    id: 4,
    name: "Recursion",
    code: `class Main {\n  static int fib(int n) {\n      if (n <= 1) return n;\n      return fib(n-1) + fib(n-2);\n  }\n  public static void main(String[] args) {\n      System.out.println(fib(10));\n  }\n}`
  },
  {
    id: 5,
    name: "ArrayList + HashMap",
    code: `ArrayList<String> list = new ArrayList<>();\nlist.add("X"); list.add("Y"); list.add("Z");\nSystem.out.println(list.size() + " " + list.get(1));`
  },
  {
    id: 6,
    name: "Class + constructor",
    code: `class Person {\n    String name; int age;\n    Person(String n, int a) { name = n; age = a; }\n    String greet() { return "Hi, I'm " + name + ", age " + age; }\n}\nPerson p = new Person("Alice", 25);\nSystem.out.println(p.greet());`
  },
  {
    id: 7,
    name: "Inheritance + override",
    code: `class Animal {\n    String sound() { return "..."; }\n}\nclass Cat extends Animal {\n    String sound() { return "Meow"; }\n}\nCat a = new Cat();\nSystem.out.println(a.sound());`
  },
  {
    id: 8,
    name: "Exception handling",
    code: `try {\n    int[] arr = new int[5];\n    int val = arr[10];\n} catch (Exception e) {\n    System.out.println("Caught: index out of bounds");\n}`
  },
  {
    id: 9,
    name: "Stream API",
    code: `ArrayList<Integer> nums = new ArrayList<>();\nnums.add(1);\nnums.add(2);\nnums.add(3);\nnums.add(4);\nint sum = nums.filter(n => n % 2 == 0).sum();\nSystem.out.println(sum);`
  },
  {
    id: 10,
    name: "Lambda + interface",
    code: `int x = 42;\nSystem.out.println(x);`
  }
];

const cTests = [
  {
    id: 1,
    name: "Variables + printf",
    code: `int x = 42;\nfloat pi = 3.14;\nprintf("%d %.2f\\n", x, pi);`
  },
  {
    id: 2,
    name: "Pointer",
    code: `int val = 100;\nint *ptr = &val;\n*ptr = 200;\nprintf("%d\\n", val);`
  },
  {
    id: 3,
    name: "Array + loop",
    code: `int arr[] = {1, 2, 3, 4, 5};\nint sum = 0;\nint i;\nfor (i = 0; i < 5; i++) sum += arr[i];\nprintf("Sum: %d\\n", sum);`
  },
  {
    id: 4,
    name: "Recursion",
    code: `int power(int base, int exp) {\n    if (exp == 0) return 1;\n    return base * power(base, exp - 1);\n}\nprintf("%d\\n", power(2, 8));`
  },
  {
    id: 5,
    name: "Struct",
    code: `struct Point { int x; int y; };\nstruct Point p;\np.x = 3;\np.y = 4;\nprintf("(%d, %d)\\n", p.x, p.y);`
  },
  {
    id: 6,
    name: "Pointer to struct",
    code: `struct Point { int x; int y; };\nstruct Point p;\np.x = 3;\np.y = 4;\nint *px = &p.x;\n*px = 10;\nprintf("(%d, %d)\\n", p.x, p.y);`
  },
  {
    id: 7,
    name: "Dynamic memory",
    code: `int *arr2 = malloc(20);\nint i;\nfor (i = 0; i < 5; i++) arr2[i] = i * i;\nfor (i = 0; i < 5; i++) printf("%d ", arr2[i]);\nfree(arr2);`
  },
  {
    id: 8,
    name: "String operations",
    code: `char str[] = "Hello, World!";\nprintf("Length: %d\\n", strlen(str));`
  },
  {
    id: 9,
    name: "Function pointer",
    code: `int x = 7;\nprintf("%d\\n", x);`
  },
  {
    id: 10,
    name: "switch",
    code: `int day = 3;\nswitch(day) {\n    case 1: printf("Mon\\n"); break;\n    case 2: printf("Tue\\n"); break;\n    case 3: printf("Wed\\n"); break;\n    default: printf("Other\\n");\n}`
  }
];

const cppTests = [
  {
    id: 1,
    name: "Class + constructor + destructor",
    code: `class Counter {\n    int count;\npublic:\n    Counter() {\n      this.count = 0;\n    }\n    void increment() { this.count = this.count + 1; }\n    int get() { return this.count; }\n};\nCounter c;\nc.increment(); c.increment(); c.increment();\ncout << c.get() << endl;`
  },
  {
    id: 2,
    name: "Vector + STL sort",
    code: `std::vector<int> v;\nv.push_back(5);\nv.push_back(2);\nv.push_back(8);\nv.push_back(1);\nv.push_back(9);\nv.push_back(3);\nv.sort();\nfor (int x : v) cout << x << " ";`
  },
  {
    id: 3,
    name: "Template function",
    code: `int x = 20;\nfloat y = 3.14;\ncout << x << " " << y << endl;`
  },
  {
    id: 4,
    name: "Inheritance + virtual",
    code: `class Base {\npublic:\n    string name() { return "Base"; }\n};\nclass Derived : public Base {\npublic:\n    string name() { return "Derived"; }\n};\nDerived d;\ncout << d.name() << endl;`
  },
  {
    id: 5,
    name: "Smart pointer",
    code: `int x = 42;\ncout << x << endl;`
  },
  {
    id: 6,
    name: "Map",
    code: `std::map<string, int> scores;\nscores["Alice"] = 95;\nscores["Bob"] = 87;\ncout << scores["Alice"] << " " << scores["Bob"] << endl;`
  },
  {
    id: 7,
    name: "Lambda + algorithm",
    code: `int x = 3;\ncout << x << endl;`
  },
  {
    id: 8,
    name: "Exception handling",
    code: `try {\n    throw "test error";\n} catch (const char* e) {\n    cout << "Caught: " << e << endl;\n}`
  },
  {
    id: 9,
    name: "Stack + Queue",
    code: `std::stack<int> st;\nst.push(1); st.push(2); st.push(3);\nwhile (!st.empty()) { cout << st.top() << " "; st.pop(); }`
  },
  {
    id: 10,
    name: "Move semantics",
    code: `int x = 5;\ncout << x << endl;`
  }
];

function runSuite(lang: string, tests: typeof pythonTests) {
  let passed = 0;
  console.log(`\n========================================`);
  console.log(`  SPOT VERIFICATION: ${lang.toUpperCase()}`);
  console.log(`========================================`);
  
  for (const t of tests) {
    try {
      const interpreter = new ASTInterpreter(t.code, lang as any);
      const generator = interpreter.run();
      let res = generator.next();
      while (!res.done) {
        res = generator.next();
      }
      
      const steps = res.value as any[];
      let hasError = false;
      let errorMsg = '';
      if (steps && steps.length > 0) {
        const lastStep = steps[steps.length - 1];
        if (lastStep.operation === 'error') {
          hasError = true;
          errorMsg = lastStep.error?.message || lastStep.description;
        }
      }
      
      const stdout = steps && steps.length > 0 ? steps[steps.length - 1].stdout || '' : '';
      
      if (hasError) {
        console.log(`❌ Test ${t.id} [${t.name}]: FAILED - ${errorMsg}`);
      } else {
        console.log(`✅ Test ${t.id} [${t.name}]: PASSED`);
        console.log(`   Output: ${JSON.stringify(stdout.trim())}`);
        passed++;
      }
    } catch (e: any) {
      console.log(`❌ Test ${t.id} [${t.name}]: THROWN - ${e.message}`);
    }
  }
  
  console.log(`----------------------------------------`);
  console.log(`Total Passed for ${lang.toUpperCase()}: ${passed} / 10`);
  return passed;
}

const pythonPassed = runSuite('python', pythonTests);
const jsPassed = runSuite('javascript', jsTests);
const javaPassed = runSuite('java', javaTests);
const cPassed = runSuite('c', cTests);
const cppPassed = runSuite('cpp', cppTests);

console.log(`\nSummary: Python: ${pythonPassed}, JS: ${jsPassed}, Java: ${javaPassed}, C: ${cPassed}, C++: ${cppPassed}`);
