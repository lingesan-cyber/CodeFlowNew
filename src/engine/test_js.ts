import { JavaScriptParser } from './languages/js'; 
const p = new JavaScriptParser('let name = "World"; let s = `Hello ${name}`;'); 
console.log(JSON.stringify(p.parse(), null, 2));
