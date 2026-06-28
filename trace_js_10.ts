import { JSParser } from './src/engine/languages/javascript';

const code = `function counter() {
    let count = 0;
    return () => {
        count = count + 1;
        return count;
    };
}
const inc = counter();
console.log(inc(), inc(), inc());`;

try {
  const parser = new JSParser(code);
  const ast = parser.parse();
  console.log("AST parsed successfully!");
} catch (e: any) {
  console.error(e.stack);
}
