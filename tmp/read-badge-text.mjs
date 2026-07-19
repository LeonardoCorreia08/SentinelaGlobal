import { readFileSync } from 'fs';
const c = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');
// Find the part with 'IA:' and print the surrounding text until the closing </span>
const idx = c.indexOf('IA:');
if (idx >= 0) {
  // Find the closing div for this badge section (next </div> after the badge span)
  const endIdx = c.indexOf('</div>', idx + 200);
  const section = c.substring(idx - 50, endIdx + 20);
  console.log('=== IA BADGE SECTION ===');
  console.log(section);
}
