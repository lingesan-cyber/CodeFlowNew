const fs = require('fs');
const file = 'd:/codexproject/src/engine/languages/c.ts';
let code = fs.readFileSync(file, 'utf8');

const regex = /\s*\/\/\s*Regular variable declaration e\.g\. int x = 10;[\s\S]*?loc: this\.getLoc\(startToken\)\s*\};\s*\}/;

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

      return decls.length === 1 ? decls[0] : decls;
    }`;

if (code.match(regex)) {
  code = code.replace(regex, newVarBlock);
  console.log("Variable block replaced successfully.");
} else {
  console.log("COULD NOT FIND VAR BLOCK");
}

fs.writeFileSync(file, code);
