import { BaseParser } from '../parser';
import { Statement, Expression } from '../ast';

export class JSParser extends BaseParser {
  private currentClassName: string | null = null;

  constructor(code: string) {
    super(code, 'javascript');
  }

  public parse(): Statement[] {
    const statements: Statement[] = [];
    while (!this.match('EOF')) {
      try {
        const stmt = this.parseStatement();
        if (stmt) statements.push(stmt);
      } catch (err) {
        // Fallback or throw
        throw err;
      }
    }
    return statements;
  }

  protected parseStatement(): Statement | null {
    const t = this.peek();

    if (t.type === 'PUNCTUATION' && t.value === ';') {
      this.next();
      return null;
    }

    // Class definition: class ClassName { constructor(...) { ... } method() { ... } }
    if (t.type === 'KEYWORD' && t.value === 'class') {
      const startToken = this.next();
      const className = this.consume('IDENTIFIER');
      let baseClass: string | undefined;
      if (this.match('KEYWORD', 'extends')) {
        this.next(); // consume extends
        baseClass = this.consume('IDENTIFIER').value; // consume base class
      }
      this.consume('PUNCTUATION', '{');
      
      const prevClass = this.currentClassName;
      this.currentClassName = className.value;
      
      const body: Statement[] = [];
      while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
        const memberToken = this.peek();
        // Skip standalone semicolons
        if (memberToken.type === 'PUNCTUATION' && memberToken.value === ';') {
          this.next();
          continue;
        }
        
        // Method or constructor
        let isConstructor = false;
        let name = '';
        if (memberToken.type === 'IDENTIFIER') {
          name = this.next().value;
          if (name === 'constructor') {
            isConstructor = true;
          }
        } else if (memberToken.type === 'KEYWORD' && memberToken.value === 'constructor') {
          this.next();
          name = 'constructor';
          isConstructor = true;
        } else {
          // If unexpected token, let parseStatement handle it or throw
          throw new Error(`Unexpected token "${memberToken.value}" in class body`);
        }
        
        this.consume('PUNCTUATION', '(');
        const params: Array<{ name: string; type: string }> = [];
        // Prepend 'this' parameter for method / constructor
        params.push({ name: 'this', type: 'any' });
        
        while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
          const pName = this.consume('IDENTIFIER');
          params.push({ name: pName.value, type: 'any' });
          if (this.match('PUNCTUATION', ',')) this.next();
        }
        this.consume('PUNCTUATION', ')');
        
        this.consume('PUNCTUATION', '{');
        const methodBody = this.parseBlock();
        
        body.push({
          type: 'FunctionDeclaration',
          name: isConstructor ? (className.value + '.__init__') : (className.value + '.' + name),
          params,
          returnType: 'any',
          body: methodBody,
          loc: this.getLoc(memberToken)
        });
      }
      
      this.consume('PUNCTUATION', '}');
      this.currentClassName = prevClass;
      
      return {
        type: 'FunctionDeclaration',
        name: className.value + '.class_init',
        params: [],
        returnType: 'void',
        body,
        baseClass: baseClass || undefined,
        loc: this.getLoc(startToken)
      } as any;
    }

    // Variable declaration: let, const, var
    if (t.type === 'KEYWORD' && (t.value === 'let' || t.value === 'const' || t.value === 'var')) {
      const startToken = this.next();
      const nameToken = this.consume('IDENTIFIER');
      let valueExpr: Expression | undefined;
      if (this.match('OPERATOR', '=')) {
        this.next();
        valueExpr = this.parseExpression();
      }
      if (this.match('PUNCTUATION', ';')) this.next();
      return {
        type: 'VarDeclaration',
        name: nameToken.value,
        varType: startToken.value,
        valueExpr,
        loc: this.getLoc(startToken)
      };
    }

    // Function declaration: function name(params) { body }
    if (t.type === 'KEYWORD' && t.value === 'function') {
      const startToken = this.next();
      const nameToken = this.consume('IDENTIFIER');
      this.consume('PUNCTUATION', '(');
      const params: Array<{ name: string; type: string }> = [];
      while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
        const pName = this.consume('IDENTIFIER');
        params.push({ name: pName.value, type: 'any' });
        if (this.match('PUNCTUATION', ',')) this.next();
      }
      this.consume('PUNCTUATION', ')');
      this.consume('PUNCTUATION', '{');
      const body = this.parseBlock();
      return {
        type: 'FunctionDeclaration',
        name: nameToken.value,
        params,
        returnType: 'any',
        body,
        loc: this.getLoc(startToken)
      };
    }

    // Return statement: return expr;
    if (t.type === 'KEYWORD' && t.value === 'return') {
      const startToken = this.next();
      let valueExpr: Expression | undefined;
      if (!this.match('PUNCTUATION', ';') && !this.match('EOF')) {
        valueExpr = this.parseExpression();
      }
      if (this.match('PUNCTUATION', ';')) this.next();
      return {
        type: 'ReturnStatement',
        valueExpr,
        loc: this.getLoc(startToken)
      };
    }

    // Break statement: break
    if (t.type === 'KEYWORD' && t.value === 'break') {
      const startToken = this.next();
      if (this.match('PUNCTUATION', ';')) this.next();
      return { type: 'BreakStatement', loc: this.getLoc(startToken) };
    }

    // Continue statement: continue
    if (t.type === 'KEYWORD' && t.value === 'continue') {
      const startToken = this.next();
      if (this.match('PUNCTUATION', ';')) this.next();
      return { type: 'ContinueStatement', loc: this.getLoc(startToken) };
    }

    // Throw statement: throw expr;
    if (t.type === 'KEYWORD' && t.value === 'throw') {
      const startToken = this.next();
      const expr = this.parseExpression();
      if (this.match('PUNCTUATION', ';')) this.next();
      return { type: 'ThrowStatement', expr, loc: this.getLoc(startToken) };
    }

    // Try/catch/finally
    if (t.type === 'KEYWORD' && t.value === 'try') {
      const startToken = this.next();
      this.consume('PUNCTUATION', '{');
      const tryBody = this.parseBlock();
      let exceptBody: Statement[] = [];
      let errorVar: string | undefined;
      let finallyBody: Statement[] | undefined;
      if (this.match('KEYWORD', 'catch')) {
        this.next();
        if (this.match('PUNCTUATION', '(')) {
          this.next();
          if (this.match('IDENTIFIER')) errorVar = this.next().value;
          if (this.match('PUNCTUATION', ')')) this.next();
        }
        this.consume('PUNCTUATION', '{');
        exceptBody = this.parseBlock();
      }
      if (this.match('KEYWORD', 'finally')) {
        this.next();
        this.consume('PUNCTUATION', '{');
        finallyBody = this.parseBlock();
      }
      return { type: 'TryStatement', tryBody, exceptBody, errorVar, finallyBody, loc: this.getLoc(startToken) };
    }

    // Switch statement: switch (expr) { case x: ... default: ... }
    if (t.type === 'KEYWORD' && t.value === 'switch') {
      const startToken = this.next();
      this.consume('PUNCTUATION', '(');
      const discriminant = this.parseExpression();
      this.consume('PUNCTUATION', ')');
      this.consume('PUNCTUATION', '{');
      const cases: Array<{ value: Expression | null; body: Statement[] }> = [];
      while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
        if (this.match('KEYWORD', 'case')) {
          this.next();
          const caseVal = this.parseExpression();
          this.consume('OPERATOR', ':');
          const body: Statement[] = [];
          while (!this.match('KEYWORD', 'case') && !this.match('KEYWORD', 'default') && !this.match('PUNCTUATION', '}') && !this.match('EOF')) {
            const s = this.parseStatement();
            if (s) body.push(s);
          }
          cases.push({ value: caseVal, body });
        } else if (this.match('KEYWORD', 'default')) {
          this.next();
          this.consume('OPERATOR', ':');
          const body: Statement[] = [];
          while (!this.match('KEYWORD', 'case') && !this.match('KEYWORD', 'default') && !this.match('PUNCTUATION', '}') && !this.match('EOF')) {
            const s = this.parseStatement();
            if (s) body.push(s);
          }
          cases.push({ value: null, body });
        } else { this.next(); }
      }
      this.consume('PUNCTUATION', '}');
      return { type: 'SwitchStatement', discriminant, cases, loc: this.getLoc(startToken) };
    }

    // Conditional: if (cond) { body } else { body }
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

      const elseIfs: { condition: Expression; body: Statement[] }[] = [];
      let elseBody: Statement[] | undefined;

      while (this.match('KEYWORD', 'else') && this.peek(1).type === 'KEYWORD' && this.peek(1).value === 'if') {
        this.next(); // consume else
        this.next(); // consume if
        this.consume('PUNCTUATION', '(');
        const elifCondition = this.parseExpression();
        this.consume('PUNCTUATION', ')');
        
        let elifBody: Statement[] = [];
        if (this.match('PUNCTUATION', '{')) {
          this.next();
          elifBody = this.parseBlock();
        } else {
          const singleStmt = this.parseStatement();
          if (singleStmt) elifBody.push(singleStmt);
        }
        elseIfs.push({ condition: elifCondition, body: elifBody });
      }

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
        elseIfs: elseIfs.length > 0 ? elseIfs : undefined,
        elseBody,
        loc: this.getLoc(startToken)
      };
    }

    // Loop: while (cond) { body }
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

    // Loop: for (let i = 0; i < n; i++) { body }
    if (t.type === 'KEYWORD' && t.value === 'for') {
      const startToken = this.next();
      this.consume('PUNCTUATION', '(');
      
      let init: Statement | undefined;
      if (!this.match('PUNCTUATION', ';')) {
        // Can be declaration or expression
        const isDecl = this.match('KEYWORD', 'let') || this.match('KEYWORD', 'var') || this.match('KEYWORD', 'const');
        if (isDecl) {
          const dToken = this.next();
          const nameToken = this.consume('IDENTIFIER');
          
          if ((this.peek().type === 'KEYWORD' || this.peek().type === 'IDENTIFIER') && (this.peek().value === 'of' || this.peek().value === 'in')) {
            this.next(); // consume of/in
            const iterable = this.parseExpression();
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
              loopType: 'for-range',
              iteratorVar: nameToken.value,
              iterable,
              body,
              loc: this.getLoc(startToken)
            };
          }
          
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

    // Output check: console.log(args)
    if (t.type === 'IDENTIFIER' && t.value === 'console' && this.peek(1).value === '.') {
      const startToken = this.next(); // console
      this.consume('PUNCTUATION', '.');
      this.consume('IDENTIFIER', 'log');
      this.consume('PUNCTUATION', '(');
      const exprs: Expression[] = [];
      while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
        exprs.push(this.parseExpression());
        if (this.match('PUNCTUATION', ',')) this.next();
      }
      this.consume('PUNCTUATION', ')');
      if (this.match('PUNCTUATION', ';')) this.next();
      return {
        type: 'Output',
        exprs,
        appendNewline: true,
        loc: this.getLoc(startToken)
      };
    }

    // Let's check prompt() function which parses as an input statement
    if (t.type === 'IDENTIFIER' && t.value === 'prompt') {
      const startToken = this.next();
      this.consume('PUNCTUATION', '(');
      let promptMsg = 'Enter value: ';
      if (this.match('STRING')) {
        promptMsg = this.next().value;
      }
      this.consume('PUNCTUATION', ')');
      if (this.match('PUNCTUATION', ';')) this.next();

      return {
        type: 'Input',
        prompt: promptMsg,
        target: { type: 'Identifier', name: 'tempInput', loc: this.getLoc(startToken) },
        expectedType: 'string',
        loc: this.getLoc(startToken)
      };
    }

    // General expression statement (e.g. assignments, function calls)
    const expr = this.parseExpression();
    if (this.match('PUNCTUATION', ';')) this.next();

    // Check if expression is assignment or input prompt (e.g., let x = prompt())
    if (expr.type === 'BinaryOp' && expr.operator === '=' && expr.right.type === 'FunctionCall' && expr.right.name === 'prompt') {
      const promptArg = expr.right.args[0];
      const promptMsg = promptArg && promptArg.type === 'Literal' ? String(promptArg.value) : 'Enter value:';
      return {
        type: 'Input',
        prompt: promptMsg,
        target: expr.left,
        expectedType: 'string',
        loc: expr.loc
      };
    }

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
