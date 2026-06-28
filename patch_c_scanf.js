const fs = require('fs');

let cCode = fs.readFileSync('src/engine/languages/c.ts', 'utf8');

const oldScanf = `    // Input: scanf(format, &x)
    if (t.type === 'KEYWORD' && t.value === 'scanf') {
      const startToken = this.next();
      this.consume('PUNCTUATION', '(');
      const formatStrToken = this.consume('STRING');
      this.consume('PUNCTUATION', ',');
      const targetExpr = this.parseExpression(); // should be &x AddressOf
      this.consume('PUNCTUATION', ')');
      this.consume('PUNCTUATION', ';');

      // Deduce expected type from format string e.g. %d -> integer, %f -> float, %s -> string
      let expectedType: 'string' | 'number' | 'integer' | 'float' = 'string';
      if (formatStrToken.value.includes('%d')) expectedType = 'integer';
      else if (formatStrToken.value.includes('%f')) expectedType = 'float';

      return {
        type: 'Input',
        prompt: \`Enter \${expectedType}:\`,
        target: targetExpr,
        expectedType,
        loc: this.getLoc(startToken)
      };
    }`;

const newScanf = `    // Input: scanf(format, &x, ...)
    if (t.type === 'KEYWORD' && t.value === 'scanf') {
      const startToken = this.next();
      this.consume('PUNCTUATION', '(');
      const formatStrToken = this.consume('STRING');
      
      const targets = [];
      while (this.match('PUNCTUATION', ',')) {
        this.consume('PUNCTUATION', ',');
        targets.push(this.parseExpression());
      }
      this.consume('PUNCTUATION', ')');
      this.consume('PUNCTUATION', ';');

      return {
        type: 'Input',
        prompt: 'scanf',
        formatStr: formatStrToken.value,
        targets,
        loc: this.getLoc(startToken)
      };
    }`;

if (cCode.includes(oldScanf)) {
  cCode = cCode.replace(oldScanf, newScanf);
  fs.writeFileSync('src/engine/languages/c.ts', cCode);
  console.log('Patched c.ts correctly');
} else {
  console.log('Failed to patch c.ts: oldScanf not found exactly');
  
  // Try fallback string splitting
  const start = "    // Input: scanf(format, &x)";
  const end = "      };\\n    }";
  const startIndex = cCode.indexOf(start);
  if (startIndex !== -1) {
    const afterStart = cCode.substring(startIndex);
    const endIndex = afterStart.indexOf("    // General expressions / assignments");
    if (endIndex !== -1) {
       const block = afterStart.substring(0, endIndex);
       cCode = cCode.replace(block, newScanf + '\\n\\n');
       fs.writeFileSync('src/engine/languages/c.ts', cCode);
       console.log('Patched using fallback correctly');
    } else {
       console.log('Fallback failed');
    }
  }
}
