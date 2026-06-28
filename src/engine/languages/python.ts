import { BaseParser } from '../parser';
import { Statement, Expression, VarDeclarationNode } from '../ast';

export class PythonParser extends BaseParser {
  private currentClassName: string | null = null;

  constructor(code: string) {
    super(code, 'python');
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

  protected parseStatement(): Statement | null {
    const t = this.peek();

    // Skip standalone newlines or semicolons
    if (t.type === 'NEWLINE' || (t.type === 'PUNCTUATION' && t.value === ';')) {
      this.next();
      return null;
    }

    // Decorator: @decorator_name\n def ...
    if (t.type === 'OPERATOR' && t.value === '@') {
      this.next(); // consume @
      // consume decorator name (could be identifier chain like @staticmethod or @property.setter)
      while (this.match('IDENTIFIER') || (this.peek().type === 'PUNCTUATION' && this.peek().value === '.')) {
        this.next();
      }
      // consume optional parentheses: @decorator(args)
      if (this.match('PUNCTUATION', '(')) {
        this.next();
        let depth = 1;
        while (depth > 0 && !this.match('EOF')) {
          if (this.match('PUNCTUATION', '(')) depth++;
          else if (this.match('PUNCTUATION', ')')) depth--;
          this.next();
        }
      }
      if (this.match('NEWLINE')) this.next();
      return null; // decorator itself is not a statement — next statement is the actual def
    }

    // Function definition: def name(p1, *args, **kwargs):
    if (t.type === 'KEYWORD' && t.value === 'def') {
      const startToken = this.next();
      const nameToken = this.consume('IDENTIFIER');
      let funcName = nameToken.value;
      if (this.currentClassName) {
        funcName = this.currentClassName + '.' + funcName;
      }
      this.consume('PUNCTUATION', '(');
      const params: Array<{ name: string; type: string }> = [];
      while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
        // Handle *args and **kwargs
        if (this.match('OPERATOR', '**')) {
          this.next(); // consume **
          const pName = this.consume('IDENTIFIER');
          params.push({ name: '**' + pName.value, type: 'any' });
        } else if (this.match('OPERATOR', '*')) {
          this.next(); // consume *
          if (this.match('IDENTIFIER')) {
            const pName = this.next();
            params.push({ name: '*' + pName.value, type: 'any' });
          }
        } else {
          const pName = this.consume('IDENTIFIER');
          // Handle default value: param=default
          if (this.match('OPERATOR', '=')) {
            this.next();
            this.parseExpression(); // consume default, discard
          }
          // Handle type annotation: param: Type
          if (this.match('OPERATOR', ':')) {
            this.next();
            this.parseExpression(); // consume type hint, discard
          }
          params.push({ name: pName.value, type: 'any' });
        }
        if (this.match('PUNCTUATION', ',')) this.next();
      }
      this.consume('PUNCTUATION', ')');
      // Handle return type annotation: -> Type
      if (this.match('OPERATOR', '->')) {
        this.next();
        this.parseExpression(); // consume type hint, discard
      }
      this.consume('OPERATOR', ':');
      this.consume('NEWLINE');
      
      this.consume('INDENT');
      const body = this.parseBlock();

      return {
        type: 'FunctionDeclaration',
        name: funcName,
        params,
        returnType: 'any',
        body,
        loc: this.getLoc(startToken)
      };
    }

    // Return statement: return expr
    if (t.type === 'KEYWORD' && t.value === 'return') {
      const startToken = this.next();
      let valueExpr: Expression | undefined;
      if (!this.match('NEWLINE') && !this.match('EOF')) {
        valueExpr = this.parseExpression();
      }
      if (this.match('NEWLINE')) this.next();
      return {
        type: 'ReturnStatement',
        valueExpr,
        loc: this.getLoc(startToken)
      };
    }

    // Pass statement
    if (t.type === 'KEYWORD' && t.value === 'pass') {
      const startToken = this.next();
      if (this.match('NEWLINE')) this.next();
      return {
        type: 'ExpressionStatement',
        expr: { type: 'Literal', value: null, valueType: 'null', loc: this.getLoc(startToken) },
        loc: this.getLoc(startToken)
      };
    }

    // Yield statement (inside generator)
    if (t.type === 'KEYWORD' && t.value === 'yield') {
      const startToken = this.next();
      let valueExpr: Expression | undefined;
      if (!this.match('NEWLINE') && !this.match('EOF')) {
        valueExpr = this.parseExpression();
      }
      if (this.match('NEWLINE')) this.next();
      return {
        type: 'ReturnStatement', // treat yield as return for our purposes
        valueExpr,
        loc: this.getLoc(startToken)
      };
    }

    // With statement: with expr as var:
    if (t.type === 'KEYWORD' && t.value === 'with') {
      const startToken = this.next();
      const ctxExpr = this.parseExpression(); // e.g. open('file', 'r')
      let asVar: string | undefined;
      if (this.match('KEYWORD', 'as')) {
        this.next();
        asVar = this.consume('IDENTIFIER').value;
      }
      this.consume('OPERATOR', ':');
      this.consume('NEWLINE');
      this.consume('INDENT');
      const body = this.parseBlock();
      // Wrap: assign ctxExpr result to asVar, then execute body
      const stmts: Statement[] = [];
      if (asVar) {
        stmts.push({
          type: 'VarDeclaration',
          name: asVar,
          varType: 'any',
          valueExpr: ctxExpr,
          loc: this.getLoc(startToken)
        });
      }
      stmts.push(...body);
      return { type: 'TryStatement', tryBody: stmts, exceptBody: [], finallyBody: [], loc: this.getLoc(startToken) };
    }

    // Break statement: break
    if (t.type === 'KEYWORD' && t.value === 'break') {
      const startToken = this.next();
      if (this.match('NEWLINE')) this.next();
      return { type: 'BreakStatement', loc: this.getLoc(startToken) };
    }

    // Continue statement: continue
    if (t.type === 'KEYWORD' && t.value === 'continue') {
      const startToken = this.next();
      if (this.match('NEWLINE')) this.next();
      return { type: 'ContinueStatement', loc: this.getLoc(startToken) };
    }

    // Raise statement: raise ExceptionExpr
    if (t.type === 'KEYWORD' && t.value === 'raise') {
      const startToken = this.next();
      const expr = this.parseExpression();
      if (this.match('NEWLINE')) this.next();
      return { type: 'ThrowStatement', expr, loc: this.getLoc(startToken) };
    }

    // Try-Except statement: try: ... except [Exception]: ...
    if (t.type === 'KEYWORD' && t.value === 'try') {
      const startToken = this.next();
      this.consume('OPERATOR', ':');
      this.consume('NEWLINE');
      this.consume('INDENT');
      const tryBody = this.parseBlock();

      let exceptBody: Statement[] = [];
      let errorVar: string | undefined;

      const nextT = this.peek();
      if (nextT.type === 'KEYWORD' && nextT.value === 'except') {
        this.next(); // consume except
        if (this.match('IDENTIFIER')) {
          errorVar = this.next().value;
        }
        this.consume('OPERATOR', ':');
        this.consume('NEWLINE');
        this.consume('INDENT');
        exceptBody = this.parseBlock();
      }

      let finallyBody: Statement[] | undefined;
      if (this.peek().type === 'KEYWORD' && this.peek().value === 'finally') {
        this.next();
        this.consume('OPERATOR', ':');
        this.consume('NEWLINE');
        this.consume('INDENT');
        finallyBody = this.parseBlock();
      }

      return {
        type: 'TryStatement',
        tryBody,
        exceptBody,
        errorVar,
        finallyBody,
        loc: this.getLoc(startToken)
      };
    }

    // Class definition: class ClassName(BaseClassName):
    if (t.type === 'KEYWORD' && t.value === 'class') {
      const startToken = this.next();
      const className = this.consume('IDENTIFIER');
      
      let baseClass: string | undefined;
      if (this.match('PUNCTUATION', '(')) {
        this.next(); // consume '('
        if (this.match('IDENTIFIER')) {
          baseClass = this.next().value;
          while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
            this.next();
          }
        }
        this.consume('PUNCTUATION', ')');
      }
      
      this.consume('OPERATOR', ':');
      this.consume('NEWLINE');
      
      const prevClass = this.currentClassName;
      this.currentClassName = className.value;
      
      this.consume('INDENT');
      const body = this.parseBlock();
      
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

    // Conditional: if cond: ... elif cond: ... else: ...
    if (t.type === 'KEYWORD' && (t.value === 'if' || t.value === 'elif')) {
      const startToken = this.next();
      const condition = this.parseExpression();
      this.consume('OPERATOR', ':');
      
      let thenBody: Statement[] = [];
      if (this.match('NEWLINE')) {
        this.next();
        this.consume('INDENT');
        thenBody = this.parseBlock();
      } else {
        const stmt = this.parseStatement();
        if (stmt) thenBody.push(stmt);
      }

      const elseIfs: { condition: Expression; body: Statement[] }[] = [];
      let elseBody: Statement[] | undefined;

      while (this.peek().type === 'KEYWORD' && this.peek().value === 'elif') {
        this.next(); // consume elif
        const elifCondition = this.parseExpression();
        this.consume('OPERATOR', ':');
        let elifBody: Statement[] = [];
        if (this.match('NEWLINE')) {
          this.next();
          this.consume('INDENT');
          elifBody = this.parseBlock();
        } else {
          const stmt = this.parseStatement();
          if (stmt) elifBody.push(stmt);
        }
        elseIfs.push({ condition: elifCondition, body: elifBody });
      }

      if (this.peek().type === 'KEYWORD' && this.peek().value === 'else') {
        this.next(); // consume else
        this.consume('OPERATOR', ':');
        if (this.match('NEWLINE')) {
          this.next();
          this.consume('INDENT');
          elseBody = this.parseBlock();
        } else {
          elseBody = [];
          const stmt = this.parseStatement();
          if (stmt) elseBody.push(stmt);
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

    // Loop: while cond:
    if (t.type === 'KEYWORD' && t.value === 'while') {
      const startToken = this.next();
      const condition = this.parseExpression();
      this.consume('OPERATOR', ':');
      this.consume('NEWLINE');

      this.consume('INDENT');
      const body = this.parseBlock();

      return {
        type: 'Loop',
        loopType: 'while',
        condition,
        body,
        loc: this.getLoc(startToken)
      };
    }

    // Loop: for i in range(10):
    // Or: for k, v in d.items():
    if (t.type === 'KEYWORD' && t.value === 'for') {
      const startToken = this.next();
      const loopVars: string[] = [];
      loopVars.push(this.consume('IDENTIFIER').value);
      while (this.match('PUNCTUATION', ',')) {
        this.next(); // consume ','
        loopVars.push(this.consume('IDENTIFIER').value);
      }
      this.consume('KEYWORD', 'in');

      const iterableExpr = this.parseExpression();
      this.consume('OPERATOR', ':');
      this.consume('NEWLINE');

      this.consume('INDENT');
      const body = this.parseBlock();

      return {
        type: 'Loop',
        loopType: 'for-range',
        iteratorVar: loopVars.join(','),
        iterable: iterableExpr,
        body,
        loc: this.getLoc(startToken)
      };
    }

    // Output check: print(exprs)
    if ((t.type === 'KEYWORD' || t.type === 'IDENTIFIER') && t.value === 'print') {
      const startToken = this.next();
      this.consume('PUNCTUATION', '(');
      const exprs: Expression[] = [];
      while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
        exprs.push(this.parseExpression());
        if (this.match('PUNCTUATION', ',')) this.next();
      }
      this.consume('PUNCTUATION', ')');
      if (this.match('NEWLINE')) this.next();
      return {
        type: 'Output',
        exprs,
        appendNewline: true,
        loc: this.getLoc(startToken)
      };
    }

    // General expression or assignment statement
    const expr = this.parseExpression();
    if (this.match('PUNCTUATION', ';')) this.next();
    if (this.match('NEWLINE')) this.next();

    // Check if it matches an input statement: x = input("prompt") or x = int(input())
    if (expr.type === 'BinaryOp' && expr.operator === '=') {
      let isInput = false;
      let promptMsg = '';
      let expectedType: 'string' | 'number' | 'integer' | 'float' = 'string';

      const rhs = expr.right;
      if (rhs.type === 'FunctionCall' && rhs.name === 'input') {
        isInput = true;
        const arg = rhs.args[0];
        if (arg && arg.type === 'Literal') promptMsg = String(arg.value);
      } else if (
        rhs.type === 'FunctionCall' &&
        (rhs.name === 'int' || rhs.name === 'float') &&
        rhs.args[0]?.type === 'FunctionCall' &&
        rhs.args[0].name === 'input'
      ) {
        isInput = true;
        expectedType = rhs.name === 'int' ? 'integer' : 'float';
        const arg = rhs.args[0].args[0];
        if (arg && arg.type === 'Literal') promptMsg = String(arg.value);
      }

      if (isInput) {
        return {
          type: 'Input',
          prompt: promptMsg,
          target: expr.left,
          expectedType,
          loc: expr.loc
        };
      }
    }

    // In Python, standard identifiers without keywords can act as declarations or assignments
    if (expr.type === 'BinaryOp' && expr.operator === '=' && expr.left.type === 'Identifier') {
      // Treat first assignment as VarDeclaration + Assignment Visualizer mapping
      return {
        type: 'VarDeclaration',
        name: expr.left.name,
        varType: 'any',
        valueExpr: expr.right,
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
    while (!this.match('DEDENT') && !this.match('EOF')) {
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
    }
    this.consume('DEDENT');
    return body;
  }
}
