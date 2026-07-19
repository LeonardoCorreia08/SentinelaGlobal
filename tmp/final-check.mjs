import { readFileSync } from 'fs';
const c = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');

// Find IA badge section
const iaIdx = c.indexOf('IA:');
if (iaIdx >= 0) {
  const divBefore = c.lastIndexOf('<div', iaIdx - 100);
  const divAfter = c.indexOf('</div>', iaIdx + 300);
  console.log(c.substring(divBefore, divAfter + 6));
  console.log('\n---');
}

// Check header dot
const headerIdx = c.indexOf('rounded-full inline-block mr-1.5');
if (headerIdx >= 0) {
  const start = c.lastIndexOf('<span', headerIdx - 50);
  const end = c.indexOf('/>', headerIdx) + 3;
  console.log('HEADER DOT:', c.substring(start, end));
} else {
  // Try new header pattern
  const h2 = c.indexOf('w-2 h-2');
  if (h2 >= 0) {
    const start = c.lastIndexOf('<span', h2 - 50);
    const end = c.indexOf('/>', h2) + 3;
    console.log('HEADER DOT (alt):', c.substring(start, end));
  }
}
