import { BaseParser } from '../parser';
import { Statement, Expression } from '../ast';

export class JSParser extends BaseParser {
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

  private parseStatement(): Statement | null {
    const t = this.peek();

    if (t.type === 'PUNCTUATION' && t.value === ';') {
      this.next();
      return null;
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
        const isDecl = this.match('KEYWORD', 'let') || this.match('KEYWORD', 'var');
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
