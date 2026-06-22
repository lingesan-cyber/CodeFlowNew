import { BaseParser } from '../parser';
import { Statement, Expression } from '../ast';

export class CPPParser extends BaseParser {
  constructor(code: string) {
    super(code, 'cpp');
  }

  public parse(): Statement[] {
    const statements: Statement[] = [];
    while (!this.match('EOF')) {
      try {
        const stmt = this.parseStatement();
        if (stmt) statements.push(stmt);
      } catch (err) {
        throw err;
      }
    }
    return statements;
  }

  private parseStatement(): Statement | null {
    const t = this.peek();

    if (t.type === 'PUNCTUATION' && t.value === ';') {
      this.next();
      return null;
    }

    // Skip includes and namespaces: #include <iostream>, using namespace std;
    if (t.type === 'OPERATOR' && t.value === '#') {
      while (!this.match('NEWLINE') && !this.match('EOF')) {
        this.next();
      }
      return null;
    }

    if (t.type === 'KEYWORD' && t.value === 'using') {
      while (!this.match('PUNCTUATION', ';') && !this.match('EOF')) {
        this.next();
      }
      this.consume('PUNCTUATION', ';');
      return null;
    }

    // Output: cout << x << endl;
    if (t.type === 'KEYWORD' && t.value === 'cout') {
      const startToken = this.next(); // cout
      const exprs: Expression[] = [];
      while (this.match('OPERATOR', '<<')) {
        this.next(); // consume <<
        // Check if next is endl
        if (this.match('IDENTIFIER', 'endl')) {
          this.next();
          exprs.push({ type: 'Literal', value: '\n', valueType: 'string', loc: this.getLoc(startToken) });
        } else {
          exprs.push(this.parseExpression());
        }
      }
      this.consume('PUNCTUATION', ';');
      return {
        type: 'Output',
        exprs,
        loc: this.getLoc(startToken)
      };
    }

    // Input: cin >> x >> y;
    if (t.type === 'KEYWORD' && t.value === 'cin') {
      const startToken = this.next(); // cin
      this.consume('OPERATOR', '>>');
      const targetExpr = this.parseExpression(); // Identifier or ArrayAccess
      this.consume('PUNCTUATION', ';');

      return {
        type: 'Input',
        prompt: `Enter value:`,
        target: targetExpr,
        expectedType: 'string', // Type checking resolved by variable target in runtime
        loc: this.getLoc(startToken)
      };
    }

    // CPP Types including class, vectors, templates
    const typeKeywords = ['int', 'float', 'char', 'double', 'void', 'struct', 'bool', 'string', 'vector'];
    
    // We can also have pointers: int *p
    const isType = typeKeywords.includes(t.value) || 
      (t.type === 'IDENTIFIER' && this.peek(1).type === 'OPERATOR' && this.peek(1).value === '*') ||
      (t.type === 'IDENTIFIER' && this.peek(1).type === 'OPERATOR' && this.peek(1).value === '<'); // templates like vector<int>

    if (isType) {
      const startToken = this.next(); // e.g. int, vector, string
      let varType = startToken.value;

      // Handle templates e.g. vector<int>
      if (this.match('OPERATOR', '<')) {
        this.next();
        const innerType = this.next();
        varType += '<' + innerType.value + '>';
        this.consume('OPERATOR', '>');
      }

      // Check pointers: count *
      while (this.match('OPERATOR', '*')) {
        this.next();
        varType += '*';
      }

      const nameToken = this.consume('IDENTIFIER');

      // Check if it's a function declaration e.g. int solve(...) { ... }
      if (this.match('PUNCTUATION', '(')) {
        this.next(); // consume (
        const params: Array<{ name: string; type: string }> = [];
        while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
          const pTypeToken = this.next();
          let pType = pTypeToken.value;
          if (this.match('OPERATOR', '<')) {
            this.next();
            pType += '<' + this.next().value + '>';
            this.consume('OPERATOR', '>');
          }
          while (this.match('OPERATOR', '*')) {
            this.next();
            pType += '*';
          }
          const pName = this.consume('IDENTIFIER');
          params.push({ name: pName.value, type: pType });
          if (this.match('PUNCTUATION', ',')) this.next();
        }
        this.consume('PUNCTUATION', ')');
        
        this.consume('PUNCTUATION', '{');
        const body = this.parseBlock();
        return {
          type: 'FunctionDeclaration',
          name: nameToken.value,
          params,
          returnType: varType,
          body,
          loc: this.getLoc(startToken)
        };
      }

      // Regular variable declaration e.g. int x = 10;
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
      };
    }

    // Return
    if (t.type === 'KEYWORD' && t.value === 'return') {
      const startToken = this.next();
      let valueExpr: Expression | undefined;
      if (!this.match('PUNCTUATION', ';') && !this.match('EOF')) {
        valueExpr = this.parseExpression();
      }
      this.consume('PUNCTUATION', ';');
      return {
        type: 'ReturnStatement',
        valueExpr,
        loc: this.getLoc(startToken)
      };
    }

    // Free memory allocation: delete p or delete[] p
    if (t.type === 'KEYWORD' && t.value === 'delete') {
      const startToken = this.next();
      if (this.match('PUNCTUATION', '[') && this.peek(1).value === ']') {
        this.next(); this.next();
      }
      const expr = this.parseExpression();
      this.consume('PUNCTUATION', ';');
      return {
        type: 'Free',
        expr,
        loc: this.getLoc(startToken)
      };
    }

    // Conditionals
    if (t.type === 'KEYWORD' && t.value === 'if') {
      const startToken = this.next();
      this.consume('PUNCTUATION', '(');
      const condition = this.parseExpression();
      this.consume('PUNCTUATION', ')');

      let thenBody: Statement[] = [];
      if (this.match('PUNCTUATION', '{')) {
        this.next();
        thenBody = this.parseBlock();
      } else {
        const singleStmt = this.parseStatement();
        if (singleStmt) thenBody.push(singleStmt);
      }

      let elseBody: Statement[] | undefined;
      if (this.match('KEYWORD', 'else')) {
        this.next();
        elseBody = [];
        if (this.match('PUNCTUATION', '{')) {
          this.next();
          elseBody = this.parseBlock();
        } else {
          const singleStmt = this.parseStatement();
          if (singleStmt) elseBody.push(singleStmt);
        }
      }

      return {
        type: 'Conditional',
        condition,
        thenBody,
        elseBody,
        loc: this.getLoc(startToken)
      };
    }

    // Loops
    if (t.type === 'KEYWORD' && t.value === 'while') {
      const startToken = this.next();
      this.consume('PUNCTUATION', '(');
      const condition = this.parseExpression();
      this.consume('PUNCTUATION', ')');

      let body: Statement[] = [];
      if (this.match('PUNCTUATION', '{')) {
        this.next();
        body = this.parseBlock();
      } else {
        const singleStmt = this.parseStatement();
        if (singleStmt) body.push(singleStmt);
      }

      return {
        type: 'Loop',
        loopType: 'while',
        condition,
        body,
        loc: this.getLoc(startToken)
      };
    }

    if (t.type === 'KEYWORD' && t.value === 'for') {
      const startToken = this.next();
      this.consume('PUNCTUATION', '(');

      let init: Statement | undefined;
      if (!this.match('PUNCTUATION', ';')) {
        const isDecl = typeKeywords.includes(this.peek().value);
        if (isDecl) {
          const dToken = this.next();
          const nameToken = this.consume('IDENTIFIER');
          this.consume('OPERATOR', '=');
          const valExpr = this.parseExpression();
          init = {
            type: 'VarDeclaration',
            name: nameToken.value,
            varType: dToken.value,
            valueExpr: valExpr,
            loc: this.getLoc(dToken)
          };
        } else {
          const expr = this.parseExpression();
          init = {
            type: 'ExpressionStatement',
            expr,
            loc: expr.loc
          };
        }
      }
      this.consume('PUNCTUATION', ';');

      const condition = this.parseExpression();
      this.consume('PUNCTUATION', ';');

      let update: Statement | undefined;
      if (!this.match('PUNCTUATION', ')')) {
        const expr = this.parseExpression();
        update = {
          type: 'ExpressionStatement',
          expr,
          loc: expr.loc
        };
      }
      this.consume('PUNCTUATION', ')');

      let body: Statement[] = [];
      if (this.match('PUNCTUATION', '{')) {
        this.next();
        body = this.parseBlock();
      } else {
        const singleStmt = this.parseStatement();
        if (singleStmt) body.push(singleStmt);
      }

      return {
        type: 'Loop',
        loopType: 'for',
        init,
        condition,
        update,
        body,
        loc: this.getLoc(startToken)
      };
    }

    // General expressions / assignments
    const expr = this.parseExpression();
    this.consume('PUNCTUATION', ';');

    return {
      type: 'ExpressionStatement',
      expr,
      loc: expr.loc
    };
  }

  private parseBlock(): Statement[] {
    const body: Statement[] = [];
    while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
    }
    this.consume('PUNCTUATION', '}');
    return body;
  }
}
