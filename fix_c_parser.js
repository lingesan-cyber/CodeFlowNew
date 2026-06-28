const fs = require('fs');
const file = 'd:/codexproject/src/engine/languages/c.ts';
let code = fs.readFileSync(file, 'utf8');

// The file was messed up, so we will fix the `.push` to what they were supposed to be.
code = code.replace(/if \(Array\.isArray\(singleStmt\)\) \.push\(\.\.\.singleStmt\);\s*else \.push\(singleStmt\);/g, (match, offset, string) => {
  // We need to figure out which variable to push to.
  // We can look backward in the string to find the nearest `let (\w+): Statement\[\] = \[\];` or `elifBody` etc.
  const before = string.substring(0, offset);
  let varName = 'body';
  if (before.includes('thenBody.push(singleStmt)') || before.includes('thenBody =')) varName = 'thenBody';
  if (before.includes('elifBody.push(singleStmt)') || before.includes('elifBody =')) varName = 'elifBody';
  if (before.includes('elseBody.push(singleStmt)') || before.includes('elseBody =')) varName = 'elseBody';
  
  // Actually, we can just use simple regex to figure it out from original:
  // If we just use regex on the original file:
  return "/* ERROR */"; // Wait, I will just fix them manually since there are only 5.
});

fs.writeFileSync(file, code);
