import { readFileSync } from 'fs';
import { globSync } from 'glob';

// Search for the specific coordinate -55.542 which is distinctive for the RS border
const files = globSync('src/**/*.{ts,tsx,js,json}', { ignore: 'node_modules/**' });
console.log('Searching', files.length, 'files...');

for (const file of files) {
  try {
    const content = readFileSync(file, 'utf8');
    if (content.includes('-27.26') && content.includes('-55.542')) {
      console.log('FOUND in:', file);
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('-27.26') || lines[i].includes('-55.542')) {
          console.log(`  ${i+1}: ${lines[i].trim()}`);
        }
      }
    }
  } catch(e) {
    // skip
  }
}
