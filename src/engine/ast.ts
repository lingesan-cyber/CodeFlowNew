export type ASTNode = Statement | Expression;

export type Statement =
  | VarDeclarationNode
  | AssignmentNode
  | ConditionalNode
  | LoopNode
  | FunctionDeclarationNode
  | StructDeclarationNode
  | ReturnStatementNode
  | ExpressionStatementNode
  | OutputNode
  | InputNode
  | FreeNode
  | BreakStatementNode
  | ContinueStatementNode
  | TryStatementNode
  | SwitchStatementNode
  | ThrowStatementNode;

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
  | DictionaryLiteralNode
  | ListComprehensionNode
  | NewInstanceNode
  | LambdaNode
  | GeneratorExpressionNode;  // Python generator expression

export interface GeneratorExpressionNode extends BaseNode {
  type: 'GeneratorExpression';
  expression: Expression;
  variable: string;
  iterable: Expression;
}

export interface ListComprehensionNode extends BaseNode {
  type: 'ListComprehension';
  expression: Expression;
  iteratorVar: string;
  iterable: Expression;
  condition?: Expression;
}

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
  elseIfs?: { condition: Expression; body: Statement[] }[];
  elseBody?: Statement[];
}

export interface LoopNode extends BaseNode {
  type: 'Loop';
  loopType: 'for' | 'while' | 'do-while' | 'for-range';
  init?: Statement | Statement[];
  condition?: Expression;
  update?: Statement;
  iteratorVar?: string;
  iterable?: Expression;
  body: Statement[];
}

export interface FunctionDeclarationNode extends BaseNode {
  type: 'FunctionDeclaration';
  name: string;
  params: Array<{ name: string; type: string }>;
  returnType: string;
  body: Statement[];
}

export interface StructDeclarationNode extends BaseNode {
  type: 'StructDeclaration';
  name: string;
  fields: Array<{ name: string; type: string }>;
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
  appendNewline?: boolean;
  isPrintf?: boolean;
}

export interface InputNode extends BaseNode {
  type: 'Input';
  prompt: string;
  target?: Expression; // Identifier or AddressOf (optional for backward compatibility)
  expectedType?: 'string' | 'number' | 'integer' | 'float'; // optional
  
  // For C/C++ scanf with multiple targets
  formatStr?: string;
  targets?: Expression[];
}

export interface FreeNode extends BaseNode {
  type: 'Free';
  expr: Expression; // deallocate memory
}

export interface LiteralNode extends BaseNode {
  type: 'Literal';
  value: string | number | boolean | null | undefined;
  valueType: 'string' | 'number' | 'boolean' | 'null' | 'undefined' | 'float';
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
  objectExpr?: Expression;
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

export interface DictionaryLiteralNode extends BaseNode {
  type: 'DictionaryLiteral';
  entries: Array<{ key: Expression; value: Expression }>;
}

export interface BreakStatementNode extends BaseNode {
  type: 'BreakStatement';
}

export interface ContinueStatementNode extends BaseNode {
  type: 'ContinueStatement';
}

export interface TryStatementNode extends BaseNode {
  type: 'TryStatement';
  tryBody: Statement[];
  exceptBody: Statement[];
  errorVar?: string;
  finallyBody?: Statement[];
}

export interface SwitchStatementNode extends BaseNode {
  type: 'SwitchStatement';
  discriminant: Expression;
  cases: Array<{ value: Expression | null; body: Statement[] }>;
}

export interface ThrowStatementNode extends BaseNode {
  type: 'ThrowStatement';
  expr: Expression;
}

export interface LambdaNode extends BaseNode {
  type: 'Lambda';
  params: Array<{ name: string; type: string }>;
  body: Statement[] | Expression;
}
