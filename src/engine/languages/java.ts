import { BaseParser } from '../parser';
import { Statement, Expression } from '../ast';

export class JavaParser extends BaseParser {
  constructor(code: string) {
    super(code, 'java');
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

    // Skip packages and imports
    if (t.type === 'KEYWORD' && (t.value === 'import' || t.value === 'package')) {
      while (!this.match('PUNCTUATION', ';') && !this.match('EOF')) {
        this.next();
      }
      this.consume('PUNCTUATION', ';');
      return null;
    }

    // Class definition: class ClassName { ... }
    // We parse it and simply extract its methods and variables.
    if (t.type === 'KEYWORD' && t.value === 'class') {
      const startToken = this.next();
      const className = this.consume('IDENTIFIER');
      this.consume('PUNCTUATION', '{');
      const body = this.parseClassBody();
      
      // For visual simplicity, if there is a main method, we lift its statements
      // or we can treat them as static/normal functions in the global registry.
      // We will yield a virtual FunctionDeclaration for each method in the class
      return {
        type: 'FunctionDeclaration',
        name: className.value + '.class_init',
        params: [],
        returnType: 'void',
        body,
        loc: this.getLoc(startToken)
      };
    }

    // Java method modifiers (public, static, void, etc.)
    const modifiers = ['public', 'private', 'protected', 'static', 'final'];
    if (t.type === 'KEYWORD' && modifiers.includes(t.value)) {
      const startToken = this.peek();
      while (modifiers.includes(this.peek().value)) {
        this.next();
      }
      
      // After modifiers, we expect the return type (or constructor)
      const typeToken = this.next(); // return type e.g. void, int, String, or class constructor
      const nameToken = this.consume('IDENTIFIER');
      
      this.consume('PUNCTUATION', '(');
      const params: Array<{ name: string; type: string }> = [];
      while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
        const pType = this.next(); // parameter type
        const pName = this.consume('IDENTIFIER');
        // Handle array param brackets `String[] args` or `String args[]`
        if (this.match('PUNCTUATION', '[') && this.peek(1).value === ']') {
          this.next(); this.next();
        }
        params.push({ name: pName.value, type: pType.value });
        if (this.match('PUNCTUATION', ',')) this.next();
      }
      this.consume('PUNCTUATION', ')');
      
      this.consume('PUNCTUATION', '{');
      const body = this.parseBlock();

      return {
        type: 'FunctionDeclaration',
        name: nameToken.value,
        params,
        returnType: typeToken.value,
        body,
        loc: this.getLoc(startToken)
      };
    }

    // Return statement
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

    // Conditional
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
        // Declaration e.g. `int i = 0` or assignment
        const typeToken = this.next(); // int
        const nameToken = this.consume('IDENTIFIER');
        this.consume('OPERATOR', '=');
        const valExpr = this.parseExpression();
        init = {
          type: 'VarDeclaration',
          name: nameToken.value,
          varType: typeToken.value,
          valueExpr: valExpr,
          loc: this.getLoc(typeToken)
        };
      }
      this.consume('PUNCTUATION', ';');

      const condition = this.parseExpression();
      this.consume('PUNCTUATION', ';');

      let update: Statement | undefined;
      if (!this.match('PUNCTUATION', '))')) {
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

    // Output: System.out.println(args) or System.out.print(args)
    if (
      t.type === 'KEYWORD' &&
      t.value === 'System' &&
      this.peek(1).value === '.' &&
      this.peek(2).value === 'out' &&
      this.peek(3).value === '.'
    ) {
      const startToken = this.next(); // System
      this.consume('PUNCTUATION', '.'); // .
      this.consume('KEYWORD', 'out'); // out
      this.consume('PUNCTUATION', '.'); // .
      this.consume('KEYWORD'); // print or println
      
      this.consume('PUNCTUATION', '(');
      const exprs: Expression[] = [];
      while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
        exprs.push(this.parseExpression());
        if (this.match('PUNCTUATION', ',')) this.next();
      }
      this.consume('PUNCTUATION', ')');
      this.consume('PUNCTUATION', ';');
      return {
        type: 'Output',
        exprs,
        loc: this.getLoc(startToken)
      };
    }

    // Variable declaration: Type name = value;
    // e.g. int x = 10; String s = new String();
    const typeBuiltins = ['int', 'float', 'double', 'char', 'void', 'boolean', 'String', 'Scanner'];
    const isVarDecl = typeBuiltins.includes(t.value) || (t.type === 'IDENTIFIER' && this.peek(1).type === 'IDENTIFIER');
    
    if (isVarDecl) {
      const startToken = this.next(); // Type name
      const nameToken = this.consume('IDENTIFIER');
      
      // Handle array type brackets if it is `int[] arr` or `int arr[]`
      let varType = startToken.value;
      if (this.match('PUNCTUATION', '[') && this.peek(1).value === ']') {
        this.next(); this.next();
        varType += '[]';
      }

      let valueExpr: Expression | undefined;
      if (this.match('OPERATOR', '=')) {
        this.next();
        valueExpr = this.parseExpression();
      }
      this.consume('PUNCTUATION', ';');

      // Check if it's a Scanner initialization: Scanner sc = new Scanner(System.in);
      // We don't execute Scanner constructor in full, just treat it as Scanner declaration
      
      return {
        type: 'VarDeclaration',
        name: nameToken.value,
        varType,
        valueExpr,
        loc: this.getLoc(startToken)
      };
    }

    // General expressions / assignments
    const expr = this.parseExpression();
    this.consume('PUNCTUATION', ';');

    // Handle Java Scanner inputs: sc.nextInt() or sc.nextLine()
    // Handle Java Scanner inputs: sc.nextInt() or sc.nextLine()
    if (expr.type === 'BinaryOp' && expr.operator === '=' && expr.right.type === 'FunctionCall') {
      const call = expr.right;
      const scannerMethods = ['nextInt', 'nextDouble', 'nextLine', 'nextFloat', 'next'];
      if (scannerMethods.includes(call.name)) {
        let expectedType: 'string' | 'number' | 'integer' | 'float' = 'string';
        if (call.name === 'nextInt') expectedType = 'integer';
        else if (call.name === 'nextDouble' || call.name === 'nextFloat') expectedType = 'float';
        
        return {
          type: 'Input',
          prompt: `Enter ${expectedType} for ${call.name}():`,
          target: expr.left,
          expectedType,
          loc: expr.loc
        };
      }
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

  private parseClassBody(): Statement[] {
    const body: Statement[] = [];
    while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
    }
    this.consume('PUNCTUATION', '}');
    return body;
  }
}
