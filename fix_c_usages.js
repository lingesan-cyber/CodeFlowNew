const fs = require('fs');

let cCode = fs.readFileSync('src/engine/languages/c.ts', 'utf8');

cCode = cCode.replace(/const stmt = this\.parseStatement\(\);\r?\n\s*if \(stmt\) statements\.push\(stmt\);/g, 
  "const stmt = this.parseStatement();\n      if (stmt) {\n        if (Array.isArray(stmt)) statements.push(...stmt);\n        else statements.push(stmt);\n      }");

cCode = cCode.replace(/const singleStmt = this\.parseStatement\(\);\r?\n\s*if \(singleStmt\) body\.push\(singleStmt\);/g,
  "const singleStmt = this.parseStatement();\n        if (singleStmt) {\n          if (Array.isArray(singleStmt)) body.push(...singleStmt);\n          else body.push(singleStmt);\n        }");
        
cCode = cCode.replace(/const stmt = this\.parseStatement\(\);\r?\n\s*if \(stmt\) body\.push\(stmt\);/g,
  "const stmt = this.parseStatement();\n      if (stmt) {\n        if (Array.isArray(stmt)) body.push(...stmt);\n        else body.push(stmt);\n      }");

fs.writeFileSync('src/engine/languages/c.ts', cCode);
console.log('Fixed parseStatement usages in c.ts');
