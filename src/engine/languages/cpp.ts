import { BaseParser } from '../parser';
import { Statement, Expression } from '../ast';

export class CPPParser extends BaseParser {
  private currentClassName: string | null = null;

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

  protected parseStatement(): Statement | null {
    let t = this.peek();

    // Skip optional modifiers like const, static, volatile
    while (t.type === 'KEYWORD' && (t.value === 'const' || t.value === 'static' || t.value === 'volatile')) {
      this.next();
      t = this.peek();
    }

    if (t.type === 'PUNCTUATION' && t.value === ';') {
      this.next();
      return null;
    }

    // Class definition: class ClassName { public: ... };
    if (t.type === 'KEYWORD' && t.value === 'class') {
      const startToken = this.next();
      const className = this.consume('IDENTIFIER');
      let baseClass: string | undefined;
      if (this.match('OPERATOR', ':')) {
        this.next(); // consume :
        if (this.match('KEYWORD', 'public') || this.match('KEYWORD', 'private') || this.match('KEYWORD', 'protected') || this.match('IDENTIFIER', 'public') || this.match('IDENTIFIER', 'private') || this.match('IDENTIFIER', 'protected')) {
          this.next();
        }
        baseClass = this.consume('IDENTIFIER').value; // consume base class
      }
      this.consume('PUNCTUATION', '{');
      
      const prevClass = this.currentClassName;
      this.currentClassName = className.value;
      
      const body: Statement[] = [];
      while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
        const nextToken = this.peek();
        
        // Skip access specifiers: public:, private:, protected:
        if ((nextToken.type === 'KEYWORD' || nextToken.type === 'IDENTIFIER') && (nextToken.value === 'public' || nextToken.value === 'private' || nextToken.value === 'protected')) {
          this.next(); // consume keyword
          this.consume('OPERATOR', ':');
          continue;
        }
        
        // Parse class member
        const memberStmt = this.parseCPPClassMember(className.value);
        if (memberStmt) {
          body.push(memberStmt);
        }
      }
      
      this.consume('PUNCTUATION', '}');
      this.consume('PUNCTUATION', ';'); // class definition ends with a semicolon in C++
      
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
    if ((t.type === 'KEYWORD' || t.type === 'IDENTIFIER') && t.value === 'cout') {
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

    if (!isType && t.type === 'IDENTIFIER') {
      let idx = 1;
      while (this.peek(idx).type === 'OPERATOR' && (this.peek(idx).value === '*' || this.peek(idx).value === '&')) {
        idx++;
      }
      if (this.peek(idx).type === 'IDENTIFIER') {
        isType = true;
      }
    }

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

      // Handle struct definition in C++
      if (startToken.value === 'struct' && this.match('IDENTIFIER')) {
        const structName = this.next();
        varType += ' ' + structName.value;

        // Is it a struct definition: struct Node { ... };
        if (this.match('PUNCTUATION', '{')) {
          this.next();
          const fields: Array<{ name: string; type: string }> = [];
          
          while (!this.match('PUNCTUATION', '}') && !this.match('EOF')) {
            let fType = '';
            if (this.match('IDENTIFIER', 'std') && this.peek(1).value === '::') {
              this.next(); this.next();
              fType = 'std::';
            }
            if (this.match('IDENTIFIER') || ['int', 'float', 'double', 'char', 'bool'].includes(this.peek().value)) {
              fType += this.next().value;
            }
            while (this.match('OPERATOR', '*') || this.match('OPERATOR', '**')) { fType += this.next().value; }
            if (this.match('IDENTIFIER')) {
              const fName = this.next().value;
              fields.push({ name: fName, type: fType });
            }
            while (!this.match('PUNCTUATION', ';') && !this.match('EOF')) this.next();
            if (this.match('PUNCTUATION', ';')) this.next();
          }
          this.consume('PUNCTUATION', '}');
          this.consume('PUNCTUATION', ';');
          
          return {
            type: 'StructDeclaration',
            name: structName.value,
            fields,
            loc: this.getLoc(startToken)
          } as any;
        }
      }

      // Handle templates e.g. vector<int>, map<string, int>
      if (this.match('OPERATOR', '<')) {
        this.next(); // consume <
        let innerTypeStr = '';
        let depth = 1;
        while (depth > 0 && !this.match('EOF')) {
          const tok = this.peek();
          if (tok.type === 'OPERATOR' && tok.value === '<') { depth++; innerTypeStr += tok.value; this.next(); }
          else if (tok.type === 'OPERATOR' && tok.value === '>') { depth--; if (depth > 0) { innerTypeStr += tok.value; this.next(); } else { this.next(); break; } }
          else { innerTypeStr += tok.value; this.next(); }
        }
        varType += '<' + innerTypeStr + '>';
      }

      // Check pointers: count *
      while (this.match('OPERATOR', '*') || this.match('OPERATOR', '**')) {
        varType += this.next().value;
      }

      const nameToken = this.consume('IDENTIFIER');

      // Check if it's a function declaration e.g. int solve(...) { ... }
      let isFuncDecl = false;
      if (this.match('PUNCTUATION', '(')) {
        if (this.peek(1).value === ')') {
          isFuncDecl = true;
        } else {
          let wordCount = 0;
          let idx = 1;
          while (this.peek(idx).value !== ',' && this.peek(idx).value !== ')' && this.peek(idx).type !== 'EOF') {
            const tok = this.peek(idx);
            if (tok.type === 'IDENTIFIER' || tok.type === 'KEYWORD') {
              wordCount++;
            }
            idx++;
          }
          if (wordCount >= 2) {
            isFuncDecl = true;
          }
        }
      }

      if (isFuncDecl) {
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
          while (this.match('OPERATOR', '*') || this.match('OPERATOR', '**')) {
            pType += this.next().value;
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
      while (this.match('PUNCTUATION', '[')) {
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
      } else if (this.match('PUNCTUATION', '(')) {
        // Constructor call syntax: Player p1("Hero", 15, 99.5);
        const startParen = this.next();
        const args: Expression[] = [];
        while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
          args.push(this.parseExpression());
          if (this.match('PUNCTUATION', ',')) this.next();
        }
        this.consume('PUNCTUATION', ')');
        valueExpr = {
          type: 'NewInstance',
          className: varType,
          args,
          loc: this.getLoc(startParen)
        };
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
          const body = [];
          while (!this.match('KEYWORD', 'case') && !this.match('KEYWORD', 'default') && !this.match('PUNCTUATION', '}') && !this.match('EOF')) {
            const s = this.parseStatement();
            if (s) body.push(s);
          }
          cases.push({ value: caseVal, body });
        } else if (this.match('KEYWORD', 'default')) {
          this.next();
          this.consume('OPERATOR', ':');
          const body = [];
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
          if (this.match('OPERATOR', ':')) {
            this.next(); // consume :
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

  private parseCPPClassMember(className: string): Statement | null {
    const t = this.peek();
    
    // Check if it is a constructor: ClassName ( params ) { body }
    if (t.type === 'IDENTIFIER' && t.value === className && this.peek(1).type === 'PUNCTUATION' && this.peek(1).value === '(') {
      const constructorToken = this.next(); // consume ClassName
      this.consume('PUNCTUATION', '(');
      const params: Array<{ name: string; type: string }> = [];
      // Prepend 'this' parameter for C++ constructor
      params.push({ name: 'this', type: 'any' });
      
      while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
        let pPrefix = '';
        if (this.match('IDENTIFIER', 'std') && this.peek(1).value === '::') {
          this.next(); this.next();
          pPrefix = 'std::';
        }
        const pTypeToken = this.next();
        let pType = pPrefix + pTypeToken.value;
        while (this.match('OPERATOR', '*') || this.match('OPERATOR', '**')) {
          pType += this.next().value;
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
        name: className + '.__init__',
        params,
        returnType: 'void',
        body,
        loc: this.getLoc(constructorToken)
      };
    }
    
    // Otherwise, parse it like a normal variable or method declaration
    let isType = false;
    let typePrefix = '';
    let startToken = t;
    
    if (t.type === 'IDENTIFIER' && t.value === 'std' && this.peek(1).value === '::') {
      isType = true;
    } else if (['int', 'float', 'char', 'double', 'void', 'bool', 'string'].includes(t.value)) {
      isType = true;
    } else if (t.type === 'IDENTIFIER') {
      isType = true;
    }
    
    if (isType) {
      if (t.type === 'IDENTIFIER' && t.value === 'std' && this.peek(1).value === '::') {
        this.next(); // std
        this.next(); // ::
        typePrefix = 'std::';
        startToken = this.peek();
      }
      this.next(); // consume type name
      let memberType = typePrefix + startToken.value;
      
      while (this.match('OPERATOR', '*') || this.match('OPERATOR', '**')) {
        memberType += this.next().value;
      }
      
      const nameToken = this.consume('IDENTIFIER');
      
      // If it's a method: ReturnType name ( params ) { body }
      if (this.match('PUNCTUATION', '(')) {
        this.next();
        const params: Array<{ name: string; type: string }> = [];
        // Prepend 'this' parameter for C++ method
        params.push({ name: 'this', type: 'any' });
        
        while (!this.match('PUNCTUATION', ')') && !this.match('EOF')) {
          let pPrefix = '';
          if (this.match('IDENTIFIER', 'std') && this.peek(1).value === '::') {
            this.next(); this.next();
            pPrefix = 'std::';
          }
          const pTypeToken = this.next();
          let pType = pPrefix + pTypeToken.value;
          while (this.match('OPERATOR', '*') || this.match('OPERATOR', '**')) {
            pType += this.next().value;
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
          name: className + '.' + nameToken.value,
          params,
          returnType: memberType,
          body,
          loc: this.getLoc(startToken)
        };
      }
      
      // Otherwise, it's a member field variable declaration: Type name;
      let valueExpr: Expression | undefined;
      if (this.match('OPERATOR', '=')) {
        this.next();
        valueExpr = this.parseExpression();
      }
      this.consume('PUNCTUATION', ';');
      
      return {
        type: 'VarDeclaration',
        name: nameToken.value,
        varType: memberType,
        valueExpr,
        loc: this.getLoc(startToken)
      };
    }
    
    this.next();
    return null;
  }
}
