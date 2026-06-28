const fs = require('fs');

let cCode = fs.readFileSync('src/engine/languages/c.ts', 'utf8');

// Fix literal newlines from previous patch script
cCode = cCode.replace(/\\n\\n/g, '\n\n');

// Replace thenBody push
cCode = cCode.replace(
    '        if (singleStmt) thenBody.push(singleStmt);',
    '        if (singleStmt) { if (Array.isArray(singleStmt)) { thenBody.push(...singleStmt); } else { thenBody.push(singleStmt); } }'
);

// Replace elseBody push
cCode = cCode.replace(
    '          if (singleStmt) elseBody.push(singleStmt);',
    '          if (singleStmt) { if (Array.isArray(singleStmt)) { elseBody.push(...singleStmt); } else { elseBody.push(singleStmt); } }'
);

fs.writeFileSync('src/engine/languages/c.ts', cCode);
console.log('Fixed c.ts pushes');
