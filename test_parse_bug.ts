
import { PythonParser } from './src/engine/languages/python';
try {
  const p = new PythonParser('sum(self.marks) / len(self.marks)');
  console.log('PARSING');
  console.log(p.parseExpression());
  console.log('DONE');
} catch (e) {
  console.error('ERROR', e);
}

