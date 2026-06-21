import { Token, tokenize } from './lexer';
import { Expression, Statement, SourceLocation } from './ast';

export abstract class BaseParser {
  protected tokens: Token[] = [];
  protected cursor = 0;
  protected lang: string;

  constructor(code: string, lang: string) {
    this.lang = lang;
    this.tokens = tokenize(code, lang);
  }

  protected peek(offset = 0): Token {
    const idx = this.cursor + offset;
    if (idx >= this.tokens.length) {
      return {
        type: 'EOF',
        value: '',
        line: this.tokens[this.tokens.length - 1]?.line || 1,
        col: this.tokens[this.tokens.length - 1]?.col || 1,
        index: this.tokens[this.tokens.length - 1]?.index || 0
      };
    }
    return this.tokens[idx];
  }

  protected next(): Token {
    const t = this.peek();
    this.cursor++;
    return t;
  }

  protected match(type: string, value?: string): boolean {
    const t = this.peek();
    if (t.type !== type) return false;
    if (value !== undefined && t.value !== value) return false;
    return true;
  }

  protected consume(type: string, value?: string): Token {
    const t = this.peek();
    if (t.type !== type) {
      throw new Error(`Expected token type ${type} but got ${t.type} (value: "${t.value}") at line ${t.line}, col ${t.col}`);
    }
    if (value !== undefined && t.value !== value) {
      throw new Error(`Expected token "${value}" but got "${t.value}" at line ${t.line}, col ${t.col}`);
    }
    return this.next();
  }

  protected getLoc(startToken: Token): SourceLocation {
    const current = this.peek();
    return {
      line: startToken.line,
      columnStart: startToken.col,
      columnEnd: current.col + (current.value.length || 0)
    };
  }

  public abstract parse(): Statement[];

  // Expression Parsing (Precedence / Pratt parsing)
  protected parseExpression(): Expression {
    return this.parseAssignment();
  }

  private parseAssignment(): Expression {
    const left = this.parseLogicalOr();
    if (this.match('OPERATOR', '=') || this.match('OPERATOR', '+=') || this.match('OPERATOR', '-=')) {
      const opToken = this.next();
      const right = this.parseAssignment();
      return {
        type: 'BinaryOp',
        left,
        operator: opToken.value,
        right,
        loc: {
          line: left.loc.line,
          columnStart: left.loc.columnStart,
          columnEnd: right.loc.columnEnd
        }
      };
    }
    return left;
  }

  private parseLogicalOr(): Expression {
    let left = this.parseLogicalAnd();
    while (this.match('OPERATOR', '||') || (this.lang === 'python' && this.match('KEYWORD', 'or'))) {
      const opToken = this.next();
      const right = this.parseLogicalAnd();
      left = {
        type: 'BinaryOp',
        left,
        operator: opToken.value,
        right,
        loc: {
          line: left.loc.line,
          columnStart: left.loc.columnStart,
          columnEnd: right.loc.columnEnd
        }
      };
    }
    return left;
  }

  private parseLogicalAnd(): Expression {
    let left = this.parseEquality();
    while (this.match('OPERATOR', '&&') || (this.lang === 'python' && this.match('KEYWORD', 'and'))) {
      const opToken = this.next();
      const right = this.parseEquality();
      left = {
        type: 'BinaryOp',
        left,
        operator: opToken.value,
        right,
        loc: {
          line: left.loc.line,
          columnStart: left.loc.columnStart,
          columnEnd: right.loc.columnEnd
        }
      };
    }
    return left;
  }

  private parseEquality(): Expression {
    let left = this.parseRelational();
    const ops = ['==', '!='];
    while (this.match('OPERATOR') && ops.includes(this.peek().value)) {
      const opToken = this.next();
      const right = this.parseRelational();
      left = {
        type: 'BinaryOp',
        left,
        operator: opToken.value,
        right,
        loc: {
          line: left.loc.line,
          columnStart: left.loc.columnStart,
          columnEnd: right.loc.columnEnd
        }
      };
    }
    return left;
  }

  private parseRelational(): Expression {
    let left = this.parseAdditive();
    const ops = ['<', '>', '<=', '>='];
    while (this.match('OPERATOR') && ops.includes(this.peek().value)) {
      const opToken = this.next();
      const right = this.parseAdditive();
      left = {
        type: 'BinaryOp',
        left,
        operator: opToken.value,
        right,
        loc: {
          line: left.loc.line,
          columnStart: left.loc.columnStart,
          columnEnd: right.loc.columnEnd
        }
      };
    }
    return left;
  }

  private parseAdditive(): Expression {
    let left = this.parseMultiplicative();
    const ops = ['+', '-'];
    while (this.match('OPERATOR') && ops.includes(this.peek().value)) {
      const opToken = this.next();
      const right = this.parseMultiplicative();
      left = {
        type: 'BinaryOp',
        left,
        operator: opToken.value,
        right,
        loc: {
          line: left.loc.line,
          columnStart: left.loc.columnStart,
          columnEnd: right.loc.columnEnd
        }
      };
    }
    return left;
  }

  private parseMultiplicative(): Expression {
    let left = this.parseUnary();
    const ops = ['*', '/', '%'];
    while (this.match('OPERATOR') && ops.includes(this.peek().value)) {
      const opToken = this.next();
      const right = this.parseUnary();
      left = {
        type: 'BinaryOp',
        left,
        operator: opToken.value,
        right,
        loc: {
          line: left.loc.line,
          columnStart: left.loc.columnStart,
          columnEnd: right.loc.columnEnd
        }
      };
    }
    return left;
  }

  private parseUnary(): Expression {
    if (this.match('OPERATOR') && (this.peek().value === '!' || this.peek().value === '-' || this.peek().value === '&' || this.peek().value === '*')) {
      const startToken = this.next();
      const expr = this.parseUnary();
      if (startToken.value === '&') {
        if (expr.type !== 'Identifier') {
          throw new Error(`Cannot take address of non-identifier at line ${startToken.line}`);
        }
        return {
          type: 'AddressOf',
          targetName: expr.name,
          loc: this.getLoc(startToken)
        };
      } else if (startToken.value === '*') {
        return {
          type: 'PointerDeref',
          pointerExpr: expr,
          loc: this.getLoc(startToken)
        };
      }
      return {
        type: 'BinaryOp',
        left: { type: 'Literal', value: 0, valueType: 'number', loc: this.getLoc(startToken) },
        operator: startToken.value,
        right: expr,
        loc: this.getLoc(startToken)
      };
    }
    if (this.lang === 'python' && this.match('KEYWORD', 'not')) {
      const startToken = this.next();
      const expr = this.parseUnary();
      return {
        type: 'BinaryOp',
        left: { type: 'Literal', value: false, valueType: 'boolean', loc: this.getLoc(startToken) },
        operator: '==',
        right: expr,
        loc: this.getLoc(startToken)
      };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expression {
    const t = this.peek();

    if (t.type === 'NUMBER') {
      const token = this.next();
      const isFloat = token.value.includes('.');
      return {
        type: 'Literal',
        value: isFloat ? parseFloat(token.value) : parseInt(token.value, 10),
        valueType: 'number',
        loc: this.getLoc(token)
      };
    }

    if (t.type === 'STRING') {
      const token = this.next();
      return {
        type: 'Literal',
        value: token.value,
        valueType: 'string',
        loc: this.getLoc(token)
      };
    }

    if (t.type === 'KEYWORD' && (t.value === 'true' || t.value === 'false')) {
      const token = this.next();
      return {
        type: 'Literal',
        value: token.value === 'true',
        valueType: 'boolean',
        loc: this.getLoc(token)
      };
    }

    if (t.type === 'KEYWORD' && (t.value === 'null' || t.value === 'NULL' || t.value === 'nullptr')) {
      const token = this.next();
      return {
        type: 'Literal',
        value: null,
        valueType: 'null',
        loc: this.getLoc(token)
      };
    }

    if (t.type === 'PUNCTUATION' && t.value === '(') {
      this.next();
      const expr = this.parseExpression();
      this.consume('PUNCTUATION', ')');
      return expr;
    }

    // Array literals (e.g. `[1, 2, 3]` or Python `[1, 2, 3]` or C `{1, 2, 3}`)
    if ((t.type === 'PUNCTUATION' && t.value === '[') || (t.type === 'PUNCTUATION' && t.value === '{' && (this.lang === 'c' || this.lang === 'cpp'))) {
      const startToken = this.next();
      const closeChar = startToken.value === '[' ? ']' : '}';
      const elements: Expression[] = [];
      while (!this.match('PUNCTUATION', closeChar) && !this.match('EOF')) {
        elements.push(this.parseExpression());
        if (this.match('PUNCTUATION', ',')) {
          this.next();
        }
      }
      this.consume('PUNCTUATION', closeChar);
      return {
        type: 'ArrayLiteral',
        elements,
        loc: this.getLoc(startToken)
      };
    }

    // Java instantiation: `new ClassName(...)`
    if (t.type === 'KEYWORD' && t.value === 'new') {
      const startToken = this.next();
      const classNameToken = this.consume('IDENTIFIER');
      // Could be array declaration `new int[5]` or object instantiation `new MyClass()`
      if (this.match('PUNCTUATION', '[')) {
        this.next();
        const sizeExpr = this.parseExpression();
        this.consume('PUNCTUATION', ']');
        return {
          type: 'NewInstance',
          className: classNameToken.value + '[]',
          args: [sizeExpr],
          loc: this.getLoc(startToken)
        };
      }
      this.consume('PUNCTUATION', '(');
      const args: Expression[] = [];
      while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
        args.push(this.parseExpression());
        if (this.match('PUNCTUATION', ',')) {
          this.next();
        }
      }
      this.consume('PUNCTUATION', ')');
      return {
        type: 'NewInstance',
        className: classNameToken.value,
        args,
        loc: this.getLoc(startToken)
      };
    }

    if (t.type === 'IDENTIFIER') {
      const token = this.next();
      let expr: Expression = {
        type: 'Identifier',
        name: token.value,
        loc: this.getLoc(token)
      };

      // Handle continuous postfixes: member access `.`, array access `[`, function call `(`, pointer arrow `->`
      while (true) {
        if (this.match('PUNCTUATION', '(')) {
          this.next();
          const args: Expression[] = [];
          while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
            args.push(this.parseExpression());
            if (this.match('PUNCTUATION', ',')) {
              this.next();
            }
          }
          this.consume('PUNCTUATION', ')');
          expr = {
            type: 'FunctionCall',
            name: (expr as { name?: string; property?: string }).name || (expr as { name?: string; property?: string }).property || 'anonymous',
            args,
            loc: {
              line: expr.loc.line,
              columnStart: expr.loc.columnStart,
              columnEnd: this.peek().col
            }
          };
        } else if (this.match('PUNCTUATION', '[')) {
          this.next();
          const indexExpr = this.parseExpression();
          this.consume('PUNCTUATION', ']');
          expr = {
            type: 'ArrayAccess',
            arrayExpr: expr,
            indexExpr,
            loc: {
              line: expr.loc.line,
              columnStart: expr.loc.columnStart,
              columnEnd: this.peek().col
            }
          };
        } else if (this.match('PUNCTUATION', '.')) {
          this.next();
          const propToken = this.consume('IDENTIFIER');
          expr = {
            type: 'MemberAccess',
            objectExpr: expr,
            property: propToken.value,
            loc: {
              line: expr.loc.line,
              columnStart: expr.loc.columnStart,
              columnEnd: propToken.col + propToken.value.length
            }
          };
        } else if (this.match('OPERATOR', '->')) {
          this.next();
          const propToken = this.consume('IDENTIFIER');
          // For pointers, `p->val` is syntax sugar for `(*p).val`
          const deref: Expression = {
            type: 'PointerDeref',
            pointerExpr: expr,
            loc: expr.loc
          };
          expr = {
            type: 'MemberAccess',
            objectExpr: deref,
            property: propToken.value,
            loc: {
              line: expr.loc.line,
              columnStart: expr.loc.columnStart,
              columnEnd: propToken.col + propToken.value.length
            }
          };
        } else {
          break;
        }
      }
      return expr;
    }

    throw new Error(`Unexpected token "${t.value}" of type ${t.type} at line ${t.line}, col ${t.col}`);
  }
}
