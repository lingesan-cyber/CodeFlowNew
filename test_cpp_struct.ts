import { CPPParser } from './src/engine/languages/cpp.ts';
const parser = new CPPParser(`
struct Player { std::string name; int level; float health; };
Player p1 = {"Hero", 15, 99.5f};
std::cout << p1.name << p1.level << p1.health;
`);
console.log(JSON.stringify(parser.parse(), null, 2));
