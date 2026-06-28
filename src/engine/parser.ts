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
  
  protected parseStatement(): Statement | Statement[] | null {
    throw new Error("parseStatement not implemented in base parser");
  }

  protected isArrowFunction(): boolean {
    let depth = 0;
    let idx = 0;
    const firstTok = this.peek(0);
    const secondTok = this.peek(1);
    if (firstTok.type === 'IDENTIFIER' && secondTok.type === 'OPERATOR' && (secondTok.value === '=>' || secondTok.value === '->')) {
      return true;
    }
    while (true) {
      const tok = this.peek(idx);
      if (tok.type === 'EOF' || tok.type === 'NEWLINE' || (tok.type === 'PUNCTUATION' && (tok.value === ';' || tok.value === '{' || tok.value === '}'))) break;
      if (tok.type === 'PUNCTUATION' && tok.value === '(') depth++;
      else if (tok.type === 'PUNCTUATION' && tok.value === ')') {
        depth--;
        if (depth === 0) {
          const nextTok = this.peek(idx + 1);
          if (nextTok.type === 'OPERATOR' && (nextTok.value === '=>' || nextTok.value === '->')) {
            return true;
          }
          break;
        }
      }
      idx++;
    }
    return false;
  }

  // Expression Parsing (Precedence / Pratt parsing)
  protected parseExpression(): Expression {
    return this.parseAssignment();
  }

  private parseAssignment(): Expression {
    const left = this.parseLogicalOr();
    const isAssignOp = this.match('OPERATOR', '=') || 
                       this.match('OPERATOR', '+=') || 
                       this.match('OPERATOR', '-=') ||
                       this.match('OPERATOR', '*=') ||
                       this.match('OPERATOR', '/=') ||
                       this.match('OPERATOR', '%=');
    if (isAssignOp) {
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
    const ops = ['==', '!=', '===', '!=='];
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
    while (
      (this.match('OPERATOR') && ops.includes(this.peek().value)) ||
      (this.lang === 'python' && this.match('KEYWORD', 'in')) ||
      (this.lang === 'python' && this.match('KEYWORD', 'not' ) && this.peek(1).type === 'KEYWORD' && this.peek(1).value === 'in') ||
      ((this.lang === 'java' || this.lang === 'javascript') && this.match('KEYWORD', 'instanceof'))
    ) {
      const isNotIn = this.lang === 'python' && this.match('KEYWORD', 'not');
      const isInstanceOf = (this.lang === 'java' || this.lang === 'javascript') && this.match('KEYWORD', 'instanceof');
      let opToken: Token;
      if (isInstanceOf) {
        opToken = this.next();
      } else if (isNotIn) {
        const notToken = this.next();
        const inToken = this.next();
        opToken = {
          type: 'KEYWORD',
          value: 'not in',
          line: notToken.line,
          col: notToken.col,
          index: notToken.index
        };
      } else {
        opToken = this.next();
      }
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
    let left = this.parseExponentiation();
    const ops = ['*', '/', '%', '//'];
    while (this.match('OPERATOR') && ops.includes(this.peek().value)) {
      const opToken = this.next();
      const right = this.parseExponentiation();
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

  private parseExponentiation(): Expression {
    let left = this.parseUnary();
    while (this.match('OPERATOR', '**')) {
      const opToken = this.next();
      const right = this.parseUnary();
      left = {
        type: 'BinaryOp',
        left,
        operator: '**',
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
    const typeKeywords = ['int', 'float', 'double', 'char', 'void', 'bool', 'boolean', 'String'];
    if ((this.lang === 'c' || this.lang === 'cpp' || this.lang === 'java') &&
        this.match('PUNCTUATION', '(') && 
        (typeKeywords.includes(this.peek(1).value) || this.peek(1).type === 'IDENTIFIER') && 
        this.peek(2).type === 'PUNCTUATION' && this.peek(2).value === ')') {
      const startToken = this.next(); // consume '('
      const castType = this.next().value; // e.g. 'int'
      this.consume('PUNCTUATION', ')');
      const expr = this.parseUnary();
      if (typeKeywords.includes(castType)) {
        let name = castType;
        if (castType === 'double') name = 'float';
        if (castType === 'bool' || castType === 'boolean') name = 'bool';
        return {
          type: 'FunctionCall',
          name,
          args: [expr],
          loc: this.getLoc(startToken)
        };
      }
      return expr;
    }

    if (this.match('OPERATOR') && (this.peek().value === '!' || this.peek().value === '-' || this.peek().value === '&' || this.peek().value === '*' || this.peek().value === '**' || this.peek().value === '++' || this.peek().value === '--')) {
      const startToken = this.next();
      const expr = this.parseUnary();

      if (startToken.value === '&') {
        if (expr.type !== 'Identifier' && expr.type !== 'MemberAccess' && expr.type !== 'ArrayAccess') {
          throw new Error(`Cannot take address of non-addressable expression at line ${startToken.line}`);
        }
        return {
          type: 'AddressOf',
          targetExpr: expr,
          targetName: expr.type === 'Identifier' ? expr.name : '',
          loc: this.getLoc(startToken)
        } as any;
      } else if (startToken.value === '*') {
        return {
          type: 'PointerDeref',
          pointerExpr: expr,
          loc: this.getLoc(startToken)
        };
      } else if (startToken.value === '**') {
        return {
          type: 'PointerDeref',
          pointerExpr: {
            type: 'PointerDeref',
            pointerExpr: expr,
            loc: this.getLoc(startToken)
          },
          loc: this.getLoc(startToken)
        };
      } else if (startToken.value === '++' || startToken.value === '--') {
        return {
          type: 'BinaryOp',
          left: expr,
          operator: startToken.value + '_prefix',
          right: { type: 'Literal', value: 1, valueType: 'number', loc: this.getLoc(startToken) },
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
    let expr: Expression | null = null;

    if (this.lang === 'python' && t.type === 'KEYWORD' && t.value === 'lambda') {
      const startToken = this.next(); // consume lambda
      const params: Array<{ name: string; type: string }> = [];
      while (!this.match('OPERATOR', ':') && !this.match('EOF')) {
        const paramToken = this.consume('IDENTIFIER');
        params.push({ name: paramToken.value, type: 'any' });
        if (this.match('PUNCTUATION', ',')) this.next();
      }
      this.consume('OPERATOR', ':');
      const bodyExpr = this.parseExpression();
      expr = {
        type: 'Lambda',
        params,
        body: bodyExpr,
        loc: this.getLoc(startToken)
      };
    } else if (this.isArrowFunction()) {
      const startToken = this.peek();
      const params: Array<{ name: string; type: string }> = [];
      if (this.match('PUNCTUATION', '(')) {
        this.next(); // consume '('
        while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
          const paramToken = this.consume('IDENTIFIER');
          params.push({ name: paramToken.value, type: 'any' });
          if (this.match('PUNCTUATION', ',')) this.next();
        }
        this.consume('PUNCTUATION', ')');
      } else {
        const paramToken = this.consume('IDENTIFIER');
        params.push({ name: paramToken.value, type: 'any' });
      }
      this.next(); // consume => or ->
      
      let body: Statement[] | Expression;
      if (this.match('PUNCTUATION', '{')) {
        this.next(); // consume '{'
        const bodyStmts: Statement[] = [];
        while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
          const stmt = this.parseStatement();
          if (stmt) {
            if (Array.isArray(stmt)) bodyStmts.push(...stmt);
            else bodyStmts.push(stmt);
          }
        }
        this.consume('PUNCTUATION', '}');
        body = bodyStmts;
      } else {
        body = this.parseExpression();
      }
      
      expr = {
        type: 'Lambda',
        params,
        body,
        loc: this.getLoc(startToken)
      };
    } else if (t.type === 'NUMBER') {
      const token = this.next();
      const isFloat = token.value.includes('.');
      expr = {
        type: 'Literal',
        value: isFloat ? parseFloat(token.value) : parseInt(token.value, 10),
        valueType: isFloat ? 'float' : 'number',
        loc: this.getLoc(token)
      };
    } else if (t.type === 'STRING') {
      const token = this.next();
      expr = {
        type: 'Literal',
        value: token.value,
        valueType: 'string',
        loc: this.getLoc(token)
      };
    } else if (t.type === 'KEYWORD' && (t.value === 'true' || t.value === 'false' || t.value === 'True' || t.value === 'False')) {
      const token = this.next();
      expr = {
        type: 'Literal',
        value: token.value.toLowerCase() === 'true',
        valueType: 'boolean',
        loc: this.getLoc(token)
      };
    } else if (t.type === 'KEYWORD' && (t.value === 'null' || t.value === 'NULL' || t.value === 'nullptr' || t.value === 'None')) {
      const token = this.next();
      expr = {
        type: 'Literal',
        value: null,
        valueType: 'null',
        loc: this.getLoc(token)
      };
    } else if (t.type === 'PUNCTUATION' && t.value === '(') {
      const startToken = this.next();
      if (this.lang === 'python' && this.match('PUNCTUATION', ')')) {
        this.next();
        expr = { type: 'ArrayLiteral', elements: [], loc: this.getLoc(startToken) };
      } else {
        const firstExpr = this.parseExpression();
        if (this.lang === 'python' && this.match('PUNCTUATION', ',')) {
          const elements = [firstExpr];
          while (this.match('PUNCTUATION', ',')) {
            this.next(); // consume ','
            if (this.match('PUNCTUATION', ')')) break;
            elements.push(this.parseExpression());
          }
          this.consume('PUNCTUATION', ')');
          expr = { type: 'ArrayLiteral', elements, loc: this.getLoc(startToken) };
        } else {
          this.consume('PUNCTUATION', ')');
          expr = firstExpr;
        }
      }
    } else if ((t.type === 'PUNCTUATION' && t.value === '[') || (t.type === 'PUNCTUATION' && t.value === '{' && (this.lang === 'c' || this.lang === 'cpp' || this.lang === 'java'))) {
      const startToken = this.next();
      const closeChar = startToken.value === '[' ? ']' : '}';
      
      if (this.match('PUNCTUATION', closeChar)) {
        this.next();
        expr = { type: 'ArrayLiteral', elements: [], loc: this.getLoc(startToken) };
      } else {
        const firstExpr = this.parseExpression();
        if (this.lang === 'python' && this.match('KEYWORD', 'for')) {
          this.next(); // consume for
          const varToken = this.consume('IDENTIFIER');
          this.consume('KEYWORD', 'in');
          const iterable = this.parseExpression();
          let condition: any = undefined;
          if (this.match('KEYWORD', 'if')) {
            this.next();
            condition = this.parseExpression();
          }
          this.consume('PUNCTUATION', closeChar);
          expr = {
            type: 'ListComprehension',
            expression: firstExpr,
            iteratorVar: varToken.value,
            iterable,
            condition,
            loc: this.getLoc(startToken)
          } as any;
        } else {
          const elements: Expression[] = [firstExpr];
          if (this.match('PUNCTUATION', ',')) {
            this.next();
          }
          while (!this.match('PUNCTUATION', closeChar) && !this.match('EOF')) {
            elements.push(this.parseExpression());
            if (this.match('PUNCTUATION', ',')) {
              this.next();
            }
          }
          this.consume('PUNCTUATION', closeChar);
          expr = {
            type: 'ArrayLiteral',
            elements,
            loc: this.getLoc(startToken)
          };
        }
      }
    } else if (t.type === 'PUNCTUATION' && t.value === '{' && this.lang !== 'c' && this.lang !== 'cpp') {
      const startToken = this.next();
      
      let isSet = false;
      if (this.lang === 'python') {
        // Python sets: lookahead to see if there is a colon before the next comma or closing brace
        let checkIdx = 0;
        let depth = 1;
        let foundColon = false;
        let isEmpty = true;
        while (this.peek(checkIdx).type !== 'EOF' && depth > 0) {
          const tok = this.peek(checkIdx);
          isEmpty = false;
          if (tok.type === 'PUNCTUATION' && tok.value === '{') depth++;
          if (tok.type === 'PUNCTUATION' && tok.value === '}') depth--;
          if (depth === 1 && tok.type === 'OPERATOR' && tok.value === ':') {
            foundColon = true;
            break;
          }
          if (depth === 1 && tok.type === 'PUNCTUATION' && tok.value === '}') {
            break;
          }
          checkIdx++;
        }
        if (!isEmpty && !foundColon) {
          isSet = true;
        }
      }
      
      if (isSet) {
        const elements: Expression[] = [];
        while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
          elements.push(this.parseExpression());
          if (this.match('PUNCTUATION', ',')) {
            this.next();
          }
        }
        this.consume('PUNCTUATION', '}');
        expr = {
          type: 'ArrayLiteral',
          elements,
          loc: this.getLoc(startToken)
        };
      } else {
        const entries: Array<{ key: Expression; value: Expression }> = [];
        while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
          const key = this.parseExpression();
          this.consume('OPERATOR', ':');
          const value = this.parseExpression();
          entries.push({ key, value });
          if (this.match('PUNCTUATION', ',')) {
            this.next();
          }
        }
        this.consume('PUNCTUATION', '}');
        expr = {
          type: 'DictionaryLiteral',
          entries,
          loc: this.getLoc(startToken)
        };
      }
    } else if (t.type === 'KEYWORD' && t.value === 'new') {
      const startToken = this.next();
      let className = '';
      if (this.match('IDENTIFIER') || this.match('KEYWORD')) {
        className += this.next().value;
        while (this.match('PUNCTUATION', '.')) {
          this.next(); // consume .
          if (this.match('IDENTIFIER') || this.match('KEYWORD')) {
            className += '.' + this.next().value;
          }
        }
      } else {
        throw new Error(`Expected class name after 'new' at line ${startToken.line}`);
      }

      if (this.match('PUNCTUATION', '[')) {
        this.next();
        const sizeExpr = this.parseExpression();
        this.consume('PUNCTUATION', ']');
        expr = {
          type: 'NewInstance',
          className: className + '[]',
          args: [sizeExpr],
          loc: this.getLoc(startToken)
        };
      } else {
        if (this.match('OPERATOR', '<')) {
          this.next();
          while (!this.match('OPERATOR', '>') && !this.match('EOF')) {
            this.next();
          }
          this.consume('OPERATOR', '>');
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
        expr = {
          type: 'NewInstance',
          className: className,
          args,
          loc: this.getLoc(startToken)
        };
      }
    } else {
      const structuralKeywords = [
        'let', 'var', 'const', 'function', 'return', 'if', 'else', 'for', 'while', 'new', 'free',
        'def', 'class', 'struct', 'elif', 'and', 'or', 'not', 'delete', 'in', 'import', 'package',
        'using', 'include', 'from'
      ];
      const isIdentifier = t.type === 'IDENTIFIER' || 
        (t.type === 'KEYWORD' && !structuralKeywords.includes(t.value));

      if (isIdentifier) {
        const token = this.next();
        expr = {
          type: 'Identifier',
          name: token.value,
          loc: this.getLoc(token)
        };
      }
    }

    if (!expr) {
      throw new Error(`Unexpected token "${t.value}" of type ${t.type} at line ${t.line}, col ${t.col}`);
    }

    // Handle continuous postfixes: member access `.`, array access `[`, function call `(`, pointer arrow `->`, postfix increment/decrement
    while (true) {
      if (this.match('PUNCTUATION', '(')) {
        this.next();
        const args: Expression[] = [];
        while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
          const argExpr = this.parseExpression();
          
          if (this.lang === 'python' && this.match('KEYWORD', 'for')) {
            const forToken = this.next(); // consume 'for'
            const varToken = this.consume('IDENTIFIER');
            this.consume('KEYWORD', 'in');
            const iterable = this.parseExpression();
            args.push({
              type: 'GeneratorExpression',
              expression: argExpr,
              variable: varToken.value,
              iterable,
              loc: this.getLoc(forToken)
            } as any);
          } else {
            args.push(argExpr);
          }

          if (this.match('PUNCTUATION', ',')) {
            this.next();
          }
        }
        this.consume('PUNCTUATION', ')');
        let objectExpr: Expression | undefined;
        let name = 'anonymous';
        if (expr.type === 'MemberAccess') {
          objectExpr = expr.objectExpr;
          name = expr.property;
        } else if (expr.type === 'Identifier') {
          name = expr.name;
        } else {
          name = (expr as any).name || (expr as any).property || 'anonymous';
        }

        expr = {
          type: 'FunctionCall',
          name,
          args,
          objectExpr,
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
        const propToken = (this.match('IDENTIFIER') || this.match('KEYWORD')) ? this.next() : null;
        if (!propToken) {
          throw new Error(`Expected property identifier after '.'`);
        }
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
        const propToken = (this.match('IDENTIFIER') || this.match('KEYWORD')) ? this.next() : null;
        if (!propToken) {
          throw new Error(`Expected property identifier after '->'`);
        }
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
      } else if (this.match('OPERATOR', '++') || this.match('OPERATOR', '--')) {
        const opToken = this.next();
        expr = {
          type: 'BinaryOp',
          left: expr,
          operator: opToken.value + '_postfix',
          right: { type: 'Literal', value: 1, valueType: 'number', loc: this.getLoc(opToken) },
          loc: {
            line: expr.loc.line,
            columnStart: expr.loc.columnStart,
            columnEnd: opToken.col + opToken.value.length
          }
        };
      } else {
        break;
      }
    }

    return expr;
  }
}
