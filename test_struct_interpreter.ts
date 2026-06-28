import { ASTInterpreter } from './src/engine/interpreter';

const code = `
#include <iostream>
#include <string>

struct Player {
    std::string name;
    int level;
    float health;
};

int main() {
    Player p1 = {"Hero", 15, 99.5f};
    std::cout << "--- Player Stats ---" << "\\n";
    std::cout << "Name: " << p1.name << "\\n";
    std::cout << "Level: " << p1.level << "\\n";
    std::cout << "Health: " << p1.health << "\\n";

    std::cout << "\\nTaking damage...\\n";
    p1.health = 80.0;
    std::cout << "New Health: " << p1.health << "\\n";

    return 0;
}
`;

const interpreter = new ASTInterpreter(code, 'cpp');
const generator = interpreter.run();
let result;
while (!(result = generator.next()).done) {
  // run to completion
}
console.log(interpreter['stdout']);
