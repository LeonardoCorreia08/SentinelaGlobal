import { readFileSync, writeFileSync } from "fs";
const path = "src/convex/proxyApi.ts";
let c = readFileSync(path, "utf8");
const old = 'model: "mixtral-8x7b-32768"';
const next = 'model: "llama-3.3-70b-versatile"';
if (c.includes(old)) {
  c = c.replace(old, next);
  writeFileSync(path, c, "utf8");
  console.log("OK: Model changed to " + next);
} else if (c.includes(next)) {
  console.log("OK: Already set to " + next);
} else {
  console.log("NOT FOUND: model line in file");
  const lines = c.split("\n");
  lines.forEach((l, i) => { if (l.includes("model:")) console.log("  line " + (i+1) + ": " + l.trim()); });
}
