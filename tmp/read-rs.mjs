import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function searchDir(dir) {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
          searchDir(fullPath);
        } else if (stat.isFile() && (entry.endsWith('.ts') || entry.endsWith('.tsx') || entry.endsWith('.json'))) {
          const content = readFileSync(fullPath, 'utf8');
          if (content.includes('-55.542') || content.includes('55.542')) {
            console.log('FOUND in:', fullPath);
          }
          if (content.includes('Rio Grande') || content.includes('POLYGON') || content.includes('MultiPolygon')) {
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes('Rio Grande') || lines[i].includes('POLYGON') || lines[i].includes('MultiPolygon')) {
                console.log(`  ${fullPath}:${i+1}: ${lines[i].trim().substring(0, 150)}`);
              }
            }
          }
        }
      } catch(e) {}
    }
  } catch(e) {}
}

searchDir('src');
console.log('Search complete.');
