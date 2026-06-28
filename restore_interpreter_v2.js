
const fs = require('fs');

const logFile = 'C:/Users/Lingesan/.gemini/antigravity-ide/brain/dc2558bf-8c17-4db2-8c49-f2935bdd972e/.system_generated/logs/transcript.jsonl';
const targetFile = 'd:/codexproject/src/engine/interpreter.ts';

const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(l => l.trim().length > 0);
let content = fs.readFileSync(targetFile, 'utf8').replace(/\r\n/g, '\n');
let applied = 0;
let errors = 0;

for (const line of lines) {
    try {
        const obj = JSON.parse(line);
        if (obj.tool_calls) {
            for (const call of obj.tool_calls) {
                if ((call.name === 'replace_file_content' || call.name === 'multi_replace_file_content') && 
                    call.args.TargetFile && call.args.TargetFile.toLowerCase().includes('interpreter.ts')) {
                    
                    console.log('Applying', call.name, call.args.Instruction);
                    
                    if (call.name === 'replace_file_content') {
                        const target = call.args.TargetContent.replace(/\r\n/g, '\n');
                        const replacement = call.args.ReplacementContent.replace(/\r\n/g, '\n');
                        if (content.includes(target)) {
                            content = content.replace(target, replacement);
                            applied++;
                        } else {
                            console.log('FAILED to match target content for:', call.args.Instruction);
                            errors++;
                        }
                    } else if (call.name === 'multi_replace_file_content') {
                        let chunks;
                        if (typeof call.args.ReplacementChunks === 'string') {
                            chunks = JSON.parse(call.args.ReplacementChunks);
                        } else {
                            chunks = call.args.ReplacementChunks;
                        }
                        for (const chunk of chunks) {
                            const target = chunk.TargetContent.replace(/\r\n/g, '\n');
                            const replacement = chunk.ReplacementContent.replace(/\r\n/g, '\n');
                            if (content.includes(target)) {
                                content = content.replace(target, replacement);
                                applied++;
                            } else {
                                console.log('FAILED to match chunk target content');
                                errors++;
                            }
                        }
                    }
                }
            }
        }
    } catch (e) {
        // ignore JSON parse errors or other errors
    }
}

fs.writeFileSync(targetFile, content);
console.log('Successfully applied ' + applied + ' edits. Failed: ' + errors);

