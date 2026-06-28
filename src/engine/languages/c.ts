import { BaseParser } from '../parser';
import { Statement, Expression } from '../ast';

export class CParser extends BaseParser {
  constructor(code: string) {
    super(code, 'c');
  }

  public parse(): Statement[] {
    const statements: Statement[] = [];
    while (!this.match('EOF')) {
      try {
        const stmt = this.parseStatement();
      if (stmt) {
        if (Array.isArray(stmt)) statements.push(...stmt);
        else statements.push(stmt);
      }
      } catch (err) {
        throw err;
      }
    }
    return statements;
  }

  protected parseStatement(): Statement | Statement[] | null {
    const t = this.peek();

    if (t.type === 'PUNCTUATION' && t.value === ';') {
      this.next();
      return null;
    }

    // Skip includes and macros: #include <stdio.h>, #define MAX 10
    if (t.type === 'OPERATOR' && t.value === '#') {
      while (!this.match('NEWLINE') && !this.match('EOF')) {
        this.next();
      }
      return null;
    }

    // Function/Method or variable declaration
    // C variable declarations start with type keywords: int, float, char, double, void, struct
    const typeKeywords = ['int', 'float', 'char', 'double', 'void', 'struct', 'bool'];
    
    // We can also have pointers: int *p
    const isType = typeKeywords.includes(t.value) || (t.type === 'IDENTIFIER' && this.peek(1).type === 'OPERATOR' && this.peek(1).value === '*');

    if (isType) {
      const startToken = this.next(); // e.g. int or struct
      let varType = startToken.value;

      // Handle struct syntax e.g. struct Node
      if (startToken.value === 'struct' && this.match('IDENTIFIER')) {
        const structName = this.next();
        varType += ' ' + structName.value;

        // Is it a struct definition: struct Node { ... };
        if (this.match('PUNCTUATION', '{')) {
          this.next();
          // Skip struct fields or parse them if needed
          while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
            this.next();
          }
          this.consume('PUNCTUATION', '}');
          this.consume('PUNCTUATION', ';');
          return null;
        }
      }

      // Check pointers: count *
      while (this.match('OPERATOR', '*')) {
        this.next();
        varType += '*';
      }

      const nameToken = this.consume('IDENTIFIER');

      // Check if it's a function declaration e.g. void swap(...) { ... }
      if (this.match('PUNCTUATION', '(')) {
        this.next(); // consume (
        const params: Array<{ name: string; type: string }> = [];
        while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
          const pTypeToken = this.next();
          let pType = pTypeToken.value;
          if (pType === 'struct') {
            pType += ' ' + this.consume('IDENTIFIER').value;
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
      }      // Regular variable declaration e.g. int x = 10, y = 20;
      const decls = [];
      let baseType = varType.replace(/\*/g, '').trim();
      let currentVarType = varType;
      let currentNameToken = nameToken;

      while (true) {
        let isArray = false;
        while (this.match('PUNCTUATION', '[')) {
          this.next(); // consume [
          if (!this.match('PUNCTUATION', ']')) {
            this.parseExpression();
          }
          this.consume('PUNCTUATION', ']');
          isArray = true;
        }

        const typeStr = isArray ? currentVarType + '[]' : currentVarType;

        let valueExpr = undefined;
        if (this.match('OPERATOR', '=')) {
          this.next();
          valueExpr = this.parseExpression();
        }

        decls.push({
          type: 'VarDeclaration' as const,
          name: currentNameToken.value,
          varType: typeStr,
          valueExpr,
          loc: this.getLoc(currentNameToken)
        });

        if (this.match('PUNCTUATION', ',')) {
          this.next(); // consume ','
          
          currentVarType = baseType;
          while (this.match('OPERATOR', '*') || this.match('OPERATOR', '**')) {
            currentVarType += this.next().value;
          }
          currentNameToken = this.consume('IDENTIFIER');
        } else {
          break;
        }
      }

      this.consume('PUNCTUATION', ';');

      return decls.length === 1 ? decls[0] : decls;
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

    // Break statement
    if (t.type === 'KEYWORD' && t.value === 'break') {
      const startToken = this.next();
      this.consume('PUNCTUATION', ';');
      return {
        type: 'BreakStatement',
        loc: this.getLoc(startToken)
      };
    }

    // Free memory allocation: free(p)
    if (t.type === 'KEYWORD' && t.value === 'free') {
      const startToken = this.next();
      this.consume('PUNCTUATION', '(');
      const expr = this.parseExpression();
      this.consume('PUNCTUATION', ')');
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
        if (singleStmt) { if (Array.isArray(singleStmt)) { thenBody.push(...singleStmt); } else { thenBody.push(singleStmt); } }
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
          if (singleStmt) { if (Array.isArray(singleStmt)) { elseBody.push(...singleStmt); } else { elseBody.push(singleStmt); } }
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
        if (singleStmt) {
          if (Array.isArray(singleStmt)) body.push(...singleStmt);
          else body.push(singleStmt);
        }
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
        // e.g. int i = 0
        const isDecl = typeKeywords.includes(this.peek().value);
        if (isDecl) {
          const dToken = this.next();
          const nameToken = this.consume('IDENTIFIER');
          this.consume('OPERATOR', '=');
          const valExpr = this.parseExpression();
          init = {
            type: 'VarDeclaration' as const,
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
        if (singleStmt) {
          if (Array.isArray(singleStmt)) body.push(...singleStmt);
          else body.push(singleStmt);
        }
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

    // Output: printf(format, args)
    if (t.type === 'KEYWORD' && t.value === 'printf') {
      const startToken = this.next();
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
        appendNewline: false,
        loc: this.getLoc(startToken)
      };
    }

    // Input: scanf(format, &x, ...)
    if (t.type === 'KEYWORD' && t.value === 'scanf') {
      const startToken = this.next();
      this.consume('PUNCTUATION', '(');
      const formatStrToken = this.consume('STRING');
      
      const targets = [];
      while (this.match('PUNCTUATION', ',')) {
        this.consume('PUNCTUATION', ',');
        targets.push(this.parseExpression());
      }
      this.consume('PUNCTUATION', ')');
      this.consume('PUNCTUATION', ';');

      return {
        type: 'Input',
        prompt: 'scanf',
        formatStr: formatStrToken.value,
        targets,
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
      if (stmt) {
        if (Array.isArray(stmt)) body.push(...stmt);
        else body.push(stmt);
      }
    }
    this.consume('PUNCTUATION', '}');
    return body;
  }
}
