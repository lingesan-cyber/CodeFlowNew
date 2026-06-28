const fs = require('fs');
const file = 'd:/codexproject/src/engine/languages/c.ts';
let code = fs.readFileSync(file, 'utf8');

// 1. Return type of parseStatement
code = code.replace(
  'protected parseStatement(): Statement | null {',
  'protected parseStatement(): Statement | Statement[] | null {'
);

// 2. public parse()
code = code.replace(
  /const stmt = this\.parseStatement\(\);\s*if \(stmt\) statements\.push\(stmt\);/,
  `const stmt = this.parseStatement();
        if (stmt) {
          if (Array.isArray(stmt)) statements.push(...stmt);
          else statements.push(stmt);
        }`
);

// 3. parseBlock
code = code.replace(
  /const stmt = this\.parseStatement\(\);\s*if \(stmt\) body\.push\(stmt\);/,
  `const stmt = this.parseStatement();
      if (stmt) {
        if (Array.isArray(stmt)) body.push(...stmt);
        else body.push(stmt);
      }`
);

// 4. all singleStmt pushes
code = code.replace(
  /const singleStmt = this\.parseStatement\(\);\s*if \(singleStmt\) (\w+)\.push\(singleStmt\);/g,
  `const singleStmt = this.parseStatement();
        if (singleStmt) {
          if (Array.isArray(singleStmt)) $1.push(...singleStmt);
          else $1.push(singleStmt);
        }`
);

// 5. switch case statements pushing
code = code.replace(
  /const s = this\.parseStatement\(\);\s*if \(s\) body\.push\(s\);/g,
  `const s = this.parseStatement();
            if (s) {
              if (Array.isArray(s)) body.push(...s);
              else body.push(s);
            }`
);

// 6. Fix multiple variable declarations
const oldVarBlock = `      // Regular variable declaration e.g. int x = 10;
      if (this.match('PUNCTUATION', '[')) {
        this.next(); // consume [
        if (!this.match('PUNCTUATION', ']')) {
          this.parseExpression();
        }
        this.consume('PUNCTUATION', ']');
        varType += '[]';
      }

      let valueExpr: Expression | undefined;
      if (this.match('OPERATOR', '=')) {
        this.next();
        valueExpr = this.parseExpression();
      }
      this.consume('PUNCTUATION', ';');

      return {
        type: 'VarDeclaration',
        name: nameToken.value,
        varType,
        valueExpr,
        loc: this.getLoc(startToken)
      };`;

const newVarBlock = `      // Regular variable declaration e.g. int x = 10, y = 20;
      const decls = [];
      let baseType = varType.replace(/\\*/g, '').trim();
      let currentVarType = varType;
      let currentNameToken = nameToken;

      while (true) {
        let isArray = false;
        while (this.match('PUNCTUATION', '[')) {
          this.next(); // consume [
          if (!this.match('PUNCTUATION', ']')) {
            this.parseExpression();
          }
          this.consume('PUNCTUATION', ']');
          isArray = true;
        }

        const typeStr = isArray ? currentVarType + '[]' : currentVarType;

        let valueExpr = undefined;
        if (this.match('OPERATOR', '=')) {
          this.next();
          valueExpr = this.parseExpression();
        }

        decls.push({
          type: 'VarDeclaration',
          name: currentNameToken.value,
          varType: typeStr,
          valueExpr,
          loc: this.getLoc(currentNameToken)
        });

        if (this.match('PUNCTUATION', ',')) {
          this.next(); // consume ','
          
          currentVarType = baseType;
          while (this.match('OPERATOR', '*') || this.match('OPERATOR', '**')) {
            currentVarType += this.next().value;
          }
          currentNameToken = this.consume('IDENTIFIER');
        } else {
          break;
        }
      }

      this.consume('PUNCTUATION', ';');

      return decls.length === 1 ? decls[0] : decls;`;

if (code.includes(oldVarBlock)) {
  code = code.replace(oldVarBlock, newVarBlock);
  console.log("Variable block replaced successfully.");
} else {
  console.log("COULD NOT FIND VAR BLOCK");
}

fs.writeFileSync(file, code);
console.log('c.ts updated successfully via script!');
