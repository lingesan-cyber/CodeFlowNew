import { BaseParser } from '../parser';
import { Statement, Expression } from '../ast';

export class JavaParser extends BaseParser {
  private currentClassName: string | null = null;

  constructor(code: string) {
    super(code, 'java');
  }

  public parse(): Statement[] {
    const statements: Statement[] = [];
    while (!this.match('EOF')) {
      try {
        const stmt = this.parseStatement();
        if (stmt) {
          this.pushStmt(statements, stmt);
        }
      } catch (err) {
        throw err;
      }
    }
    return statements;
  }

  private pushStmt(arr: Statement[], s: Statement | Statement[] | null) {
    if (!s) return;
    if (Array.isArray(s)) {
      arr.push(...s);
    } else {
      arr.push(s);
    }
  }

  protected parseStatement(): Statement | Statement[] | null {
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

    // Class definition: [modifiers] class ClassName { ... }
    const modifiers = ['public', 'private', 'protected', 'static', 'final'];
    let isClass = false;
    let lookahead = 0;
    while (lookahead < this.tokens.length - this.cursor) {
      const peekToken = this.peek(lookahead);
      if (modifiers.includes(peekToken.value)) {
        lookahead++;
      } else if (peekToken.type === 'KEYWORD' && peekToken.value === 'class') {
        isClass = true;
        break;
      } else {
        break;
      }
    }

    if (isClass) {
      const startToken = this.peek();
      // Consume modifiers
      while (modifiers.includes(this.peek().value)) {
        this.next();
      }
      this.consume('KEYWORD', 'class');
      const className = this.consume('IDENTIFIER');
      let baseClass: string | undefined;
      if (this.match('KEYWORD', 'extends')) {
        this.next(); // consume extends
        baseClass = this.consume('IDENTIFIER').value; // consume base class
      }
      if (this.match('KEYWORD', 'implements')) {
        this.next(); // consume implements
        this.consume('IDENTIFIER'); // consume interface
        while (this.match('PUNCTUATION', ',')) {
          this.next();
          this.consume('IDENTIFIER');
        }
      }
      this.consume('PUNCTUATION', '{');
      
      const prevClass = this.currentClassName;
      this.currentClassName = className.value;
      const body = this.parseClassBody();
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

    // Java declarations: constructors, methods, variables
    // First, let's scan if modifiers are present
    let hasModifiers = false;
    let modLookahead = 0;
    while (modLookahead < this.tokens.length - this.cursor) {
      if (modifiers.includes(this.peek(modLookahead).value)) {
        hasModifiers = true;
        modLookahead++;
      } else {
        break;
      }
    }

    // Now check if it's a declaration: Type name ... or name(...)
    const typeBuiltins = ['int', 'float', 'double', 'char', 'void', 'boolean', 'String', 'Scanner'];
    
    // Let's inspect the tokens after the modifiers
    const typeTokenPeek = this.peek(modLookahead);
    const nextTokenPeek = this.peek(modLookahead + 1);
    
    // A constructor: [modifiers] ClassName ( params ) { ... }
    let isConstructor = false;
    if (typeTokenPeek.type === 'IDENTIFIER' && nextTokenPeek.type === 'PUNCTUATION' && nextTokenPeek.value === '(') {
      isConstructor = true;
    }
    
    // A method or variable declaration: [modifiers] Type name
    let isVarOrMethod = false;
    if (!isConstructor && typeTokenPeek.type !== 'EOF') {
      if (typeBuiltins.includes(typeTokenPeek.value) || typeTokenPeek.type === 'IDENTIFIER') {
        // Can be: int name; or String name = ... or int name(args)
        // If the token after type is an identifier, or it's array like Type[] name
        let checkIdx = modLookahead + 1;
        if (this.peek(checkIdx).type === 'OPERATOR' && this.peek(checkIdx).value === '<') {
          let depth = 1;
          checkIdx++;
          while (depth > 0 && checkIdx < this.tokens.length) {
            const tok = this.peek(checkIdx);
            if (tok.type === 'OPERATOR' && tok.value === '<') depth++;
            else if (tok.type === 'OPERATOR' && tok.value === '>') depth--;
            else if (tok.type === 'EOF') break;
            checkIdx++;
          }
        }
        while (this.peek(checkIdx).value === '[' && this.peek(checkIdx + 1).value === ']') {
          checkIdx += 2;
        }
        
        if (this.peek(checkIdx).type === 'IDENTIFIER') {
          isVarOrMethod = true;
        }
      }
    }
    
    if (isConstructor || isVarOrMethod) {
      const startToken = this.peek();
      // Consume modifiers
      while (modifiers.includes(this.peek().value)) {
        this.next();
      }
      
      if (isConstructor) {
        const classNameToken = this.consume('IDENTIFIER');
        const funcName = classNameToken.value + '.__init__';
        
        this.consume('PUNCTUATION', '(');
        const params: Array<{ name: string; type: string }> = [];
        if (this.currentClassName) {
          params.push({ name: 'this', type: 'any' });
        }
        
        while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
          const pTypeToken = this.next(); // parameter type
          let pType = pTypeToken.value;
          while (this.match('PUNCTUATION', '[') && this.peek(1).value === ']') {
            this.next(); this.next();
            pType += '[]';
          }
          const pName = this.consume('IDENTIFIER');
          while (this.match('PUNCTUATION', '[') && this.peek(1).value === ']') {
            this.next(); this.next();
            pType += '[]';
          }
          params.push({ name: pName.value, type: pType });
          if (this.match('PUNCTUATION', ',')) this.next();
        }
        this.consume('PUNCTUATION', ')');
        
        this.consume('PUNCTUATION', '{');
        const body = this.parseBlock();
        
        return {
          type: 'FunctionDeclaration',
          name: funcName,
          params,
          returnType: classNameToken.value,
          body,
          loc: this.getLoc(startToken)
        };
      } else {
        // Method or variable declaration
        const typeToken = this.next(); // return type e.g. void, int, String
        let varType = typeToken.value;
        if (this.match('OPERATOR', '<')) {
          this.next();
          while (!this.match('OPERATOR', '>') && !this.match('EOF')) {
            const tok = this.next();
            varType += tok.value;
          }
          this.consume('OPERATOR', '>');
          varType += '<>';
        }
        while (this.match('PUNCTUATION', '[') && this.peek(1).value === ']') {
          this.next(); this.next();
          varType += '[]';
        }
        
        const nameToken = this.consume('IDENTIFIER');
        
        // Check if it is a method: Type name(params) { body }
        if (this.match('PUNCTUATION', '(')) {
          this.next();
          const params: Array<{ name: string; type: string }> = [];
          if (this.currentClassName) {
            params.push({ name: 'this', type: 'any' });
          }
          
          while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
            const pTypeToken = this.next(); // parameter type
            let pType = pTypeToken.value;
            while (this.match('PUNCTUATION', '[') && this.peek(1).value === ']') {
              this.next(); this.next();
              pType += '[]';
            }
            const pName = this.consume('IDENTIFIER');
            while (this.match('PUNCTUATION', '[') && this.peek(1).value === ']') {
              this.next(); this.next();
              pType += '[]';
            }
            params.push({ name: pName.value, type: pType });
            if (this.match('PUNCTUATION', ',')) this.next();
          }
          this.consume('PUNCTUATION', ')');

          if (this.match('KEYWORD', 'throws')) {
            this.next(); // consume throws
            this.consume('IDENTIFIER');
            while (this.match('PUNCTUATION', ',')) {
              this.next();
              this.consume('IDENTIFIER');
            }
          }
          
          this.consume('PUNCTUATION', '{');
          const body = this.parseBlock();
          
          let funcName = nameToken.value;
          if (this.currentClassName) {
            funcName = this.currentClassName + '.' + funcName;
          }
          
          return {
            type: 'FunctionDeclaration',
            name: funcName,
            params,
            returnType: varType,
            body,
            loc: this.getLoc(startToken)
          };
        } else {
          // Variable declaration: Type name = value;
          if (this.match('PUNCTUATION', '[') && this.peek(1).value === ']') {
            this.next(); this.next();
            varType += '[]';
          }
          
          let valueExpr: Expression | undefined;
          if (this.match('OPERATOR', '=')) {
            this.next();
            valueExpr = this.parseExpression();
          }
          
          let firstStmt: Statement;
          if (valueExpr && valueExpr.type === 'FunctionCall') {
            const scannerMethods = ['nextInt', 'nextDouble', 'nextLine', 'nextFloat', 'next'];
            if (scannerMethods.includes(valueExpr.name)) {
              let expectedType: 'string' | 'number' | 'integer' | 'float' = 'string';
              if (valueExpr.name === 'nextInt') expectedType = 'integer';
              else if (valueExpr.name === 'nextDouble' || valueExpr.name === 'nextFloat') expectedType = 'float';
              
              firstStmt = {
                type: 'Input',
                prompt: `Enter ${expectedType} for ${valueExpr.name}():`,
                target: { type: 'Identifier', name: nameToken.value, loc: this.getLoc(nameToken) },
                expectedType,
                loc: this.getLoc(startToken)
              };
            } else {
              firstStmt = {
                type: 'VarDeclaration',
                name: nameToken.value,
                varType,
                valueExpr,
                loc: this.getLoc(startToken)
              };
            }
          } else {
            firstStmt = {
              type: 'VarDeclaration',
              name: nameToken.value,
              varType,
              valueExpr,
              loc: this.getLoc(startToken)
            };
          }

          const decls: Statement[] = [firstStmt];
          while (this.match('PUNCTUATION', ',')) {
            this.next(); // consume ','
            const nextName = this.consume('IDENTIFIER');
            let nextVal: Expression | undefined;
            if (this.match('OPERATOR', '=')) {
              this.next();
              nextVal = this.parseExpression();
            }
            decls.push({
              type: 'VarDeclaration',
              name: nextName.value,
              varType,
              valueExpr: nextVal,
              loc: this.getLoc(nextName)
            });
          }
          this.consume('PUNCTUATION', ';');
          return decls;
        }
      }
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

    // Break statement
    if (t.type === 'KEYWORD' && t.value === 'break') {
      const startToken = this.next();
      this.consume('PUNCTUATION', ';');
      return {
        type: 'BreakStatement',
        loc: this.getLoc(startToken)
      };
    }
    // Continue statement
    if (t.type === 'KEYWORD' && t.value === 'continue') {
      const startToken = this.next();
      if (this.match('PUNCTUATION', ';')) this.next();
      return { type: 'ContinueStatement', loc: this.getLoc(startToken) };
    }

    // Throw statement
    if (t.type === 'KEYWORD' && (t.value === 'throw' || t.value === 'throws')) {
      const startToken = this.next();
      if (this.match('KEYWORD', 'new')) { this.next(); }
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
      let errorVar;
      let finallyBody;
      if (this.match('KEYWORD', 'catch')) {
        this.next();
        if (this.match('PUNCTUATION', '(')) {
          this.next();
          while (!this.match('IDENTIFIER') && !this.match('PUNCTUATION', ')') && !this.match('EOF')) this.next();
          if (this.match('IDENTIFIER')) errorVar = this.next().value;
          while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) this.next();
          this.consume('PUNCTUATION', ')');
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

    // Switch statement
    if (t.type === 'KEYWORD' && t.value === 'switch') {
      const startToken = this.next();
      this.consume('PUNCTUATION', '(');
      const discriminant = this.parseExpression();
      this.consume('PUNCTUATION', ')');
      this.consume('PUNCTUATION', '{');
      const cases = [];
      while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
        if (this.match('KEYWORD', 'case')) {
          this.next();
          const caseVal = this.parseExpression();
          this.consume('OPERATOR', ':');
          const body: Statement[] = [];
          while (!this.match('KEYWORD', 'case') && !this.match('KEYWORD', 'default') && !this.match('PUNCTUATION', '}') && !this.match('EOF')) {
            const s = this.parseStatement();
            if (s) this.pushStmt(body, s);
          }
          cases.push({ value: caseVal, body });
        } else if (this.match('KEYWORD', 'default')) {
          this.next();
          this.consume('OPERATOR', ':');
          const body: Statement[] = [];
          while (!this.match('KEYWORD', 'case') && !this.match('KEYWORD', 'default') && !this.match('PUNCTUATION', '}') && !this.match('EOF')) {
            const s = this.parseStatement();
            if (s) this.pushStmt(body, s);
          }
          cases.push({ value: null, body });
        } else { this.next(); }
      }
      this.consume('PUNCTUATION', '}');
      return { type: 'SwitchStatement', discriminant, cases, loc: this.getLoc(startToken) };
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
        if (singleStmt) this.pushStmt(thenBody, singleStmt);
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
          if (singleStmt) this.pushStmt(elifBody, singleStmt);
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
          if (singleStmt) this.pushStmt(elseBody, singleStmt);
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
        if (singleStmt) this.pushStmt(body, singleStmt);
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
        const next1 = this.peek(1);
        const next2 = this.peek(2);
        const typeBuiltins = ['int', 'float', 'double', 'char', 'void', 'boolean', 'String', 'Scanner'];
        
        const isEnhancedFor = (next1.type === 'OPERATOR' && next1.value === ':') || 
                              (next2.type === 'OPERATOR' && next2.value === ':');
                              
        if (isEnhancedFor) {
          let varName = '';
          let varType = 'any';
          if (next1.value === ':') {
            const nameToken = this.next();
            varName = nameToken.value;
          } else {
            const typeToken = this.next();
            varType = typeToken.value;
            const nameToken = this.next();
            varName = nameToken.value;
          }
          this.consume('OPERATOR', ':');
          const iterable = this.parseExpression();
          this.consume('PUNCTUATION', ')');
          
          let body: Statement[] = [];
          if (this.match('PUNCTUATION', '{')) {
            this.next();
            body = this.parseBlock();
          } else {
            const singleStmt = this.parseStatement();
            if (singleStmt) this.pushStmt(body, singleStmt);
          }
          return {
            type: 'Loop',
            loopType: 'for-range',
            iteratorVar: varName,
            iterable,
            body,
            loc: this.getLoc(startToken)
          };
        }
        
        const isDecl = typeBuiltins.includes(this.peek(0).value) || 
                       (this.peek(0).type === 'IDENTIFIER' && this.peek(1).type === 'IDENTIFIER');
                       
        if (isDecl) {
          const typeToken = this.next();
          let varType = typeToken.value;
          if (this.match('PUNCTUATION', '[') && this.peek(1).value === ']') {
            this.next(); this.next();
            varType += '[]';
          }
          const nameToken = this.consume('IDENTIFIER');
          this.consume('OPERATOR', '=');
          const valExpr = this.parseExpression();
          init = {
            type: 'VarDeclaration',
            name: nameToken.value,
            varType,
            valueExpr: valExpr,
            loc: this.getLoc(typeToken)
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
        if (singleStmt) this.pushStmt(body, singleStmt);

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
      (t.type === 'KEYWORD' || t.type === 'IDENTIFIER') &&
      t.value === 'System' &&
      this.peek(1).value === '.' &&
      this.peek(2).value === 'out' &&
      this.peek(3).value === '.'
    ) {
      const startToken = this.next(); // System
      this.consume('PUNCTUATION', '.'); // .
      this.next(); // out (can be KEYWORD or IDENTIFIER)
      this.consume('PUNCTUATION', '.'); // .
      const printMethodToken = this.next(); // consume print or println (IDENTIFIER or KEYWORD)
      const appendNewline = printMethodToken.value === 'println';
      
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
        appendNewline,
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
      if (stmt) this.pushStmt(body, stmt);
    }
    this.consume('PUNCTUATION', '}');
    return body;
  }

  private parseClassBody(): Statement[] {
    const body: Statement[] = [];
    while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
      const stmt = this.parseStatement();
      if (stmt) this.pushStmt(body, stmt);
    }
    this.consume('PUNCTUATION', '}');
    return body;
  }
}
