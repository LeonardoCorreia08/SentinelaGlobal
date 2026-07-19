import { readFileSync } from 'fs';
const c = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');
const iaIdx = c.indexOf('IA:');
if (iaIdx >= 0) {
  const endIdx = c.indexOf('</div>', iaIdx + 350);
  const section = c.substring(iaIdx - 20, endIdx + 20);
  console.log(section);
}
