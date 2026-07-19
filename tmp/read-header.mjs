import { readFileSync } from 'fs';
const c = readFileSync('src/pages/SentinelaDashboard.tsx', 'utf8');
// Find the header dot span
const idx = c.indexOf('rounded-full inline-block mr-1.5');
if (idx >= 0) {
  // Go back a bit to get the full span
  const start = c.lastIndexOf('<span', idx);
  const end = c.indexOf('/>', idx) + 3;
  console.log('=== HEADER DOT SPAN ===');
  console.log(c.substring(start, end));
} else {
  // Try finding the old header code
  console.log("Header dot pattern not found!");
  const modelIdx = c.indexOf('text-[10px] text-muted-foreground bg-muted/50');
  if (modelIdx >= 0) {
    const end = c.indexOf('</span>', modelIdx + 200);
    console.log(c.substring(modelIdx, end + 10));
  }
}
