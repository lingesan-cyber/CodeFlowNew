export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
  index: number;
}

export type TokenType =
  | 'KEYWORD'
  | 'IDENTIFIER'
  | 'NUMBER'
  | 'STRING'
  | 'OPERATOR'
  | 'PUNCTUATION'
  | 'INDENT'
  | 'DEDENT'
  | 'NEWLINE'
  | 'EOF';

export function tokenize(code: string, lang: string): Token[] {
  const tokens: Token[] = [];
  let line = 1;
  let col = 1;
  let i = 0;

  const keywords = new Set([
    'let', 'var', 'const', 'function', 'return', 'if', 'else', 'for', 'while', 'new', 'free',
    'def', 'class', 'int', 'float', 'double', 'char', 'void', 'struct', 'Scanner', 'System',
    'out', 'println', 'print', 'printf', 'scanf', 'cin', 'cout', 'include', 'import', 'from',
    'delete', 'in', 'range', 'elif', 'and', 'or', 'not', 'nullptr', 'NULL', 'true', 'false',
    'bool', 'boolean', 'String', 'prompt', 'using', 'namespace', 'True', 'False', 'None', 'break'
  ]);

  // Strip single-line and multi-line comments first or skip them in tokenization
  while (i < code.length) {
    const char = code[i];

    // Handle newlines
    if (char === '\n') {
      tokens.push({ type: 'NEWLINE', value: '\n', line, col, index: i });
      line++;
      col = 1;
      i++;
      continue;
    }

    if (char === '\r') {
      i++;
      continue;
    }

    // Skip whitespace (except for indentation logic, handled separately for Python if needed)
    if (char === ' ' || char === '\t') {
      i++;
      col++;
      continue;
    }

    // Comments check
    if (char === '/' && code[i + 1] === '/') {
      while (i < code.length && code[i] !== '\n') {
        i++;
      }
      continue;
    }
    if (char === '/' && code[i + 1] === '*') {
      i += 2;
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) {
        if (code[i] === '\n') {
          line++;
          col = 1;
        } else {
          col++;
        }
        i++;
      }
      i += 2;
      col += 2;
      continue;
    }
    if (char === '#') { // Python comment
      while (i < code.length && code[i] !== '\n') {
        i++;
      }
      continue;
    }

    // Strings
    if (char === '"' || char === "'") {
      const quote = char;
      let val = '';
      const startCol = col;
      i++; col++;
      while (i < code.length && code[i] !== quote) {
        val += code[i];
        if (code[i] === '\n') {
          line++;
          col = 1;
        } else {
          col++;
        }
        i++;
      }
      i++; col++; // skip end quote
      tokens.push({ type: 'STRING', value: val, line, col: startCol, index: i });
      continue;
    }

    // Numbers
    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(code[i + 1] || ''))) {
      let val = '';
      const startCol = col;
      while (i < code.length && /[0-9.]/.test(code[i])) {
        val += code[i];
        i++; col++;
      }
      tokens.push({ type: 'NUMBER', value: val, line, col: startCol, index: i });
      continue;
    }

    // Identifiers & Keywords
    if (/[a-zA-Z_]/.test(char)) {
      let val = '';
      const startCol = col;
      while (i < code.length && /[a-zA-Z0-9_]/.test(code[i])) {
        val += code[i];
        i++; col++;
      }
      const type = keywords.has(val) ? 'KEYWORD' : 'IDENTIFIER';
      tokens.push({ type, value: val, line, col: startCol, index: i });
      continue;
    }

    // Operators
    const tripleOps = ['===', '!=='];
    const subStr3 = code.slice(i, i + 3);
    if (tripleOps.includes(subStr3)) {
      tokens.push({ type: 'OPERATOR', value: subStr3, line, col, index: i });
      i += 3;
      col += 3;
      continue;
    }

    const multiOps = ['==', '!=', '<=', '>=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '->', '<<', '>>', '++', '--', '::'];
    const subStr = code.slice(i, i + 2);
    if (multiOps.includes(subStr)) {
      tokens.push({ type: 'OPERATOR', value: subStr, line, col, index: i });
      i += 2;
      col += 2;
      continue;
    }

    const singleOps = ['=', '+', '-', '*', '/', '%', '<', '>', '&', '!', '|', '^', '~', '?', ':'];
    if (singleOps.includes(char)) {
      tokens.push({ type: 'OPERATOR', value: char, line, col, index: i });
      i++; col++;
      continue;
    }

    // Punctuation
    const punc = ['(', ')', '{', '}', '[', ']', ';', ',', '.'];
    if (punc.includes(char)) {
      tokens.push({ type: 'PUNCTUATION', value: char, line, col, index: i });
      i++; col++;
      continue;
    }

    // Unknown characters
    i++; col++;
  }

  // Deduce indentation blocks for Python
  if (lang === 'python') {
    return processPythonIndentation(code);
  }

  // Filter out excessive newlines
  const filtered = tokens.filter(t => t.type !== 'NEWLINE');
  filtered.push({ type: 'EOF', value: '', line, col, index: i });
  return filtered;
}

function processPythonIndentation(code: string): Token[] {
  const lines = code.split('\n');
  const result: Token[] = [];
  const indentStack = [0];
  let lineNum = 1;

  for (let l = 0; l < lines.length; l++) {
    const rawLine = lines[l];
    lineNum = l + 1;

    // Skip empty lines or comment-only lines
    const trimmed = rawLine.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    // Count indentation
    let indent = 0;
    for (let c = 0; c < rawLine.length; c++) {
      if (rawLine[c] === ' ') {
        indent++;
      } else if (rawLine[c] === '\t') {
        indent += 4; // Tab size 4
      } else {
        break;
      }
    }

    // Emit INDENT or DEDENT tokens
    const currentIndent = indentStack[indentStack.length - 1];
    if (indent > currentIndent) {
      indentStack.push(indent);
      result.push({ type: 'INDENT', value: indent.toString(), line: lineNum, col: 1, index: 0 });
    } else if (indent < currentIndent) {
      while (indentStack.length > 0 && indentStack[indentStack.length - 1] > indent) {
        indentStack.pop();
        result.push({ type: 'DEDENT', value: indent.toString(), line: lineNum, col: 1, index: 0 });
      }
    }

    // Tokenize line content
    const lineTokens = tokenizeLine(rawLine.slice(indent), lineNum, indent + 1);
    result.push(...lineTokens);
    result.push({ type: 'NEWLINE', value: '\n', line: lineNum, col: rawLine.length + 1, index: 0 });
  }

  // Dedent everything at the end
  while (indentStack.length > 1) {
    indentStack.pop();
    result.push({ type: 'DEDENT', value: '0', line: lineNum + 1, col: 1, index: 0 });
  }

  result.push({ type: 'EOF', value: '', line: lineNum + 1, col: 1, index: 0 });
  return result;
}

// Tokenizes a single line (helper for python)
function tokenizeLine(lineText: string, line: number, startCol: number): Token[] {
  // We can just use the core tokenize function and shift their cols
  const tokens = tokenize(lineText, 'other');
  return tokens
    .filter(t => t.type !== 'EOF' && t.type !== 'NEWLINE')
    .map(t => ({
      ...t,
      line,
      col: t.col + startCol - 1
    }));
}
