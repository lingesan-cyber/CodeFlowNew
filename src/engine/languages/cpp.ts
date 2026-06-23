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

    // Output: cout << x << endl; or std::cout << x << endl;
    let isCout = false;
    let coutStartToken = t;
    if (t.type === 'KEYWORD' && t.value === 'cout') {
      isCout = true;
      coutStartToken = this.next(); // consume cout
    } else if (t.type === 'IDENTIFIER' && t.value === 'std' && this.peek(1).value === '::' && this.peek(2).value === 'cout') {
      isCout = true;
      coutStartToken = this.next(); // consume std
      this.next(); // consume ::
      this.next(); // consume cout
    }

    if (isCout) {
      const exprs: Expression[] = [];
      while (this.match('OPERATOR', '<<')) {
        this.next(); // consume <<
        // Check if next is endl or std::endl
        let isEndl = false;
        if (this.match('IDENTIFIER', 'endl')) {
          isEndl = true;
          this.next();
        } else if (this.match('IDENTIFIER', 'std') && this.peek(1).value === '::' && this.peek(2).value === 'endl') {
          isEndl = true;
          this.next(); // std
          this.next(); // ::
          this.next(); // endl
        }

        if (isEndl) {
          exprs.push({ type: 'Literal', value: '\n', valueType: 'string', loc: this.getLoc(coutStartToken) });
        } else {
          exprs.push(this.parseExpression());
        }
      }
      this.consume('PUNCTUATION', ';');
      return {
        type: 'Output',
        exprs,
        appendNewline: false,
        loc: this.getLoc(coutStartToken)
      };
    }

    // Input: cin >> x >> y; or std::cin >> x >> y;
    let isCin = false;
    let cinStartToken = t;
    if (t.type === 'KEYWORD' && t.value === 'cin') {
      isCin = true;
      cinStartToken = this.next(); // consume cin
    } else if (t.type === 'IDENTIFIER' && t.value === 'std' && this.peek(1).value === '::' && this.peek(2).value === 'cin') {
      isCin = true;
      cinStartToken = this.next(); // consume std
      this.next(); // consume ::
      this.next(); // consume cin
    }

    if (isCin) {
      this.consume('OPERATOR', '>>');
      const targetExpr = this.parseExpression(); // Identifier or ArrayAccess
      this.consume('PUNCTUATION', ';');

      return {
        type: 'Input',
        prompt: `Enter value:`,
        target: targetExpr,
        expectedType: 'string', // Type checking resolved by variable target in runtime
        loc: this.getLoc(cinStartToken)
      };
    }

    // CPP Types including class, vectors, templates
    const typeKeywords = ['int', 'float', 'char', 'double', 'void', 'struct', 'bool', 'string', 'vector'];
    
    // We can also have pointers: int *p
    let isType = typeKeywords.includes(t.value) || 
      (t.type === 'IDENTIFIER' && this.peek(1).type === 'OPERATOR' && this.peek(1).value === '*') ||
      (t.type === 'IDENTIFIER' && this.peek(1).type === 'OPERATOR' && this.peek(1).value === '<'); // templates like vector<int>

    let typePrefix = '';
    if (!isType && t.type === 'IDENTIFIER' && t.value === 'std' && this.peek(1).value === '::') {
      const actualType = this.peek(2);
      if (typeKeywords.includes(actualType.value) || actualType.type === 'IDENTIFIER') {
        isType = true;
      }
    }

    if (isType) {
      let startToken = t;
      if (t.type === 'IDENTIFIER' && t.value === 'std' && this.peek(1).value === '::') {
        this.next(); // std
        this.next(); // ::
        typePrefix = 'std::';
        startToken = this.peek();
      }
      this.next(); // e.g. int, vector, string
      let varType = typePrefix + startToken.value;

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
          let pPrefix = '';
          if (this.match('IDENTIFIER', 'std') && this.peek(1).value === '::') {
            this.next(); // std
            this.next(); // ::
            pPrefix = 'std::';
          }
          const pTypeToken = this.next();
          let pType = pPrefix + pTypeToken.value;
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
        let isDecl = typeKeywords.includes(this.peek().value);
        let forTypePrefix = '';
        if (!isDecl && this.match('IDENTIFIER', 'std') && this.peek(1).value === '::') {
          if (typeKeywords.includes(this.peek(2).value) || this.peek(2).type === 'IDENTIFIER') {
            isDecl = true;
          }
        }

        if (isDecl) {
          let forStartToken = this.peek();
          if (this.match('IDENTIFIER', 'std') && this.peek(1).value === '::') {
            this.next(); // std
            this.next(); // ::
            forTypePrefix = 'std::';
            forStartToken = this.peek();
          }
          this.next(); // type
          const nameToken = this.consume('IDENTIFIER');
          this.consume('OPERATOR', '=');
          const valExpr = this.parseExpression();
          init = {
            type: 'VarDeclaration',
            name: nameToken.value,
            varType: forTypePrefix + forStartToken.value,
            valueExpr: valExpr,
            loc: this.getLoc(forStartToken)
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
