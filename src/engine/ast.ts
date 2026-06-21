export type ASTNode = Statement | Expression;

export type Statement =
  | VarDeclarationNode
  | AssignmentNode
  | ConditionalNode
  | LoopNode
  | FunctionDeclarationNode
  | ReturnStatementNode
  | ExpressionStatementNode
  | OutputNode
  | InputNode
  | FreeNode;

export type Expression =
  | LiteralNode
  | IdentifierNode
  | BinaryOpNode
  | ArrayAccessNode
  | PointerDerefNode  // C/C++ *p
  | AddressOfNode     // C/C++ &x
  | MemberAccessNode  // Java/JS obj.prop
  | FunctionCallNode
  | ArrayLiteralNode
  | NewInstanceNode;  // Java new Class()

export interface SourceLocation {
  line: number;      // 1-indexed
  columnStart: number;
  columnEnd: number;
}

export interface BaseNode {
  type: string;
  loc: SourceLocation;
}

export interface VarDeclarationNode extends BaseNode {
  type: 'VarDeclaration';
  name: string;
  varType: string;
  valueExpr?: Expression;
}

export interface AssignmentNode extends BaseNode {
  type: 'Assignment';
  target: Expression; // Identifier, ArrayAccess, MemberAccess, or PointerDeref
  valueExpr: Expression;
}

export interface ConditionalNode extends BaseNode {
  type: 'Conditional';
  condition: Expression;
  thenBody: Statement[];
  elseBody?: Statement[];
}

export interface LoopNode extends BaseNode {
  type: 'Loop';
  loopType: 'for' | 'while';
  init?: Statement;
  condition: Expression;
  update?: Statement;
  body: Statement[];
}

export interface FunctionDeclarationNode extends BaseNode {
  type: 'FunctionDeclaration';
  name: string;
  params: Array<{ name: string; type: string }>;
  returnType: string;
  body: Statement[];
}

export interface ReturnStatementNode extends BaseNode {
  type: 'ReturnStatement';
  valueExpr?: Expression;
}

export interface ExpressionStatementNode extends BaseNode {
  type: 'ExpressionStatement';
  expr: Expression;
}

export interface OutputNode extends BaseNode {
  type: 'Output';
  exprs: Expression[];
}

export interface InputNode extends BaseNode {
  type: 'Input';
  prompt: string;
  target: Expression; // Identifier or AddressOf
  expectedType: 'string' | 'number' | 'integer' | 'float';
}

export interface FreeNode extends BaseNode {
  type: 'Free';
  expr: Expression; // deallocate memory
}

export interface LiteralNode extends BaseNode {
  type: 'Literal';
  value: string | number | boolean | null | undefined;
  valueType: 'string' | 'number' | 'boolean' | 'null' | 'undefined';
}

export interface IdentifierNode extends BaseNode {
  type: 'Identifier';
  name: string;
}

export interface BinaryOpNode extends BaseNode {
  type: 'BinaryOp';
  left: Expression;
  operator: string; // '+', '-', '*', '/', '%', '==', '!=', '<', '>', '<=', '>=', '&&', '||'
  right: Expression;
}

export interface ArrayAccessNode extends BaseNode {
  type: 'ArrayAccess';
  arrayExpr: Expression;
  indexExpr: Expression;
}

export interface PointerDerefNode extends BaseNode {
  type: 'PointerDeref';
  pointerExpr: Expression;
}

export interface AddressOfNode extends BaseNode {
  type: 'AddressOf';
  targetName: string;
}

export interface MemberAccessNode extends BaseNode {
  type: 'MemberAccess';
  objectExpr: Expression;
  property: string;
}

export interface FunctionCallNode extends BaseNode {
  type: 'FunctionCall';
  name: string;
  args: Expression[];
}

export interface ArrayLiteralNode extends BaseNode {
  type: 'ArrayLiteral';
  elements: Expression[];
}

export interface NewInstanceNode extends BaseNode {
  type: 'NewInstance';
  className: string;
  args: Expression[];
}
