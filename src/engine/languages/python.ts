import { BaseParser } from '../parser';
import { Statement, Expression, VarDeclarationNode } from '../ast';

export class PythonParser extends BaseParser {
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

  private parseStatement(): Statement | null {
    const t = this.peek();

    // Skip standalone newlines
    if (t.type === 'NEWLINE') {
      this.next();
      return null;
    }

    // Function definition: def name(p1, p2):
    if (t.type === 'KEYWORD' && t.value === 'def') {
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
      this.consume('OPERATOR', ':');
      this.consume('NEWLINE');
      
      this.consume('INDENT');
      const body = this.parseBlock();
      // Dedent is consumed inside parseBlock() or at the end of it.

      return {
        type: 'FunctionDeclaration',
        name: nameToken.value,
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

    // Break statement: break
    if (t.type === 'KEYWORD' && t.value === 'break') {
      const startToken = this.next();
      if (this.match('NEWLINE')) this.next();
      return {
        type: 'BreakStatement',
        loc: this.getLoc(startToken)
      };
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

      let elseBody: Statement[] | undefined;
      // Peek after block to see if elif or else follows
      const nextT = this.peek();
      if (nextT.type === 'KEYWORD' && nextT.value === 'elif') {
        const elifStmt = this.parseStatement();
        if (elifStmt) elseBody = [elifStmt];
      } else if (nextT.type === 'KEYWORD' && nextT.value === 'else') {
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
    if (t.type === 'KEYWORD' && t.value === 'for') {
      const startToken = this.next();
      const loopVar = this.consume('IDENTIFIER');
      this.consume('KEYWORD', 'in');

      const iterableExpr = this.parseExpression();
      this.consume('OPERATOR', ':');
      this.consume('NEWLINE');

      this.consume('INDENT');
      const body = this.parseBlock();

      // Convert python `for loopVar in iterable` to standard Loop node
      let init: Statement | Statement[];
      let condition: Expression;
      let update: Statement;

      if (iterableExpr.type === 'FunctionCall' && iterableExpr.name === 'range') {
        let initVal: Expression = { type: 'Literal', value: 0, valueType: 'number', loc: this.getLoc(startToken) };
        let endVal: Expression = iterableExpr;
        let stepVal: Expression = { type: 'Literal', value: 1, valueType: 'number', loc: this.getLoc(startToken) };

        const args = iterableExpr.args;
        if (args.length === 1) {
          endVal = args[0];
        } else if (args.length === 2) {
          initVal = args[0];
          endVal = args[1];
        } else if (args.length === 3) {
          initVal = args[0];
          endVal = args[1];
          stepVal = args[2];
        }

        init = {
          type: 'VarDeclaration',
          name: loopVar.value,
          varType: 'int',
          valueExpr: initVal,
          loc: this.getLoc(startToken)
        };

        condition = {
          type: 'BinaryOp',
          left: { type: 'Identifier', name: loopVar.value, loc: this.getLoc(loopVar) },
          operator: '<',
          right: endVal,
          loc: this.getLoc(startToken)
        };

        update = {
          type: 'Assignment',
          target: { type: 'Identifier', name: loopVar.value, loc: this.getLoc(loopVar) },
          valueExpr: {
            type: 'BinaryOp',
            left: { type: 'Identifier', name: loopVar.value, loc: this.getLoc(loopVar) },
            operator: '+',
            right: stepVal,
            loc: this.getLoc(startToken)
          },
          loc: this.getLoc(startToken)
        };
      } else {
        // Range-based iteration over list/array: translate using index iterator
        const lineNum = startToken.line;
        const objName = `_iter_obj_${loopVar.value}_${lineNum}`;
        const idxName = `_iter_idx_${loopVar.value}_${lineNum}`;

        init = [
          // _iter_obj = iterableExpr
          {
            type: 'VarDeclaration',
            name: objName,
            varType: 'any',
            valueExpr: iterableExpr,
            loc: this.getLoc(startToken)
          },
          // _iter_idx = 0
          {
            type: 'VarDeclaration',
            name: idxName,
            varType: 'int',
            valueExpr: { type: 'Literal', value: 0, valueType: 'number', loc: this.getLoc(startToken) },
            loc: this.getLoc(startToken)
          }
        ];

        condition = {
          type: 'BinaryOp',
          left: { type: 'Identifier', name: idxName, loc: this.getLoc(loopVar) },
          operator: '<',
          right: {
            type: 'FunctionCall',
            name: 'len',
            args: [{ type: 'Identifier', name: objName, loc: this.getLoc(loopVar) }],
            loc: this.getLoc(startToken)
          },
          loc: this.getLoc(startToken)
        };

        update = {
          type: 'Assignment',
          target: { type: 'Identifier', name: idxName, loc: this.getLoc(loopVar) },
          valueExpr: {
            type: 'BinaryOp',
            left: { type: 'Identifier', name: idxName, loc: this.getLoc(loopVar) },
            operator: '+',
            right: { type: 'Literal', value: 1, valueType: 'number', loc: this.getLoc(startToken) },
            loc: this.getLoc(startToken)
          },
          loc: this.getLoc(startToken)
        };

        // Prepend assignment of current item to loop variable inside body
        const elementAssign: Statement = {
          type: 'VarDeclaration',
          name: loopVar.value,
          varType: 'any',
          valueExpr: {
            type: 'ArrayAccess',
            arrayExpr: { type: 'Identifier', name: objName, loc: this.getLoc(loopVar) },
            indexExpr: { type: 'Identifier', name: idxName, loc: this.getLoc(loopVar) },
            loc: this.getLoc(startToken)
          },
          loc: this.getLoc(startToken)
        };
        body.unshift(elementAssign);
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

    // Output check: print(exprs)
    if (t.type === 'KEYWORD' && t.value === 'print') {
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
    if (this.match('NEWLINE')) this.next();

    // Check if it matches an input statement: x = input("prompt") or x = int(input())
    if (expr.type === 'BinaryOp' && expr.operator === '=') {
      let isInput = false;
      let promptMsg = 'Enter value:';
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
