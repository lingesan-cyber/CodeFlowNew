import { ASTInterpreter } from './src/engine/interpreter.ts';
import { CPPParser } from './src/engine/languages/cpp.ts';
const code = `
struct Player { std::string name; int level; float health; };
Player p1 = {"Hero", 15, 99.5f};
std::cout << p1.name << p1.level << p1.health;
`;
const parser = new CPPParser(code);
const ast = parser.parse();
const interpreter = new ASTInterpreter(code, 'cpp');
const g = interpreter.run();
while(!g.next().done) {}
console.log("stdout:", interpreter['stdout']);
console.log("heap:", interpreter.heap);
console.log("structs:", interpreter['structs']);
