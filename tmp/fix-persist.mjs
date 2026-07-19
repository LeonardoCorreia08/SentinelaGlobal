import { readFileSync, writeFileSync } from 'fs';
const path = 'src/pages/SentinelaDashboard.tsx';
let c = readFileSync(path, 'utf8');

// ============================================================
// Find and replace the ENTIRE IA badge section (from "IA:" to the closing </div>)
// ============================================================

// Find the wrapper div that contains "IA:" label and badge
const iaDivStart = c.indexOf('IA:');
if (iaDivStart < 0) { console.log("ERROR: IA: not found"); process.exit(1); }

// Go back to find the opening <div> of this section
const divOpen = c.lastIndexOf('<div', iaDivStart);
// Go forward to find the CLOSING </div> of this section
const divClose = c.indexOf('</div>', iaDivStart + 200);

const oldSection = c.substring(divOpen, divClose + 6);
console.log("=== OLD SECTION ===");
console.log(oldSection.substring(0, 300) + "...");

// New section with INLINE STYLED dot to guarantee it renders
const newSection = `                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-[10px] text-muted-foreground">IA:</span>
                      <span className={\`text-[10px] font-medium px-1.5 py-0.5 rounded-full border flex items-center gap-1 \${
                        modeloLLM.includes("[Cache]")
                          ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                          : modeloLLM.includes("Groq") || modeloLLM.includes("freebuff")
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-sky-500/10 text-sky-400 border-sky-500/30"
                      }\`}>
                        <span
                          className={\`rounded-full animate-pulse \${
                            modeloLLM.includes("[Cache]")
                              ? "bg-yellow-400"
                              : modeloLLM.includes("Groq") || modeloLLM.includes("freebuff")
                                ? "bg-emerald-400"
                                : "bg-sky-400"
                          }\`}
                          style={{ width: "6px", height: "6px", display: "inline-block" }}
                        />
                        <span className={\`\${
                          modeloLLM.includes("[Cache]")
                            ? "text-yellow-400"
                            : modeloLLM.includes("Groq") || modeloLLM.includes("freebuff")
                              ? "text-emerald-400"
                              : "text-sky-400"
                        }\`}>
                          {modeloLLM.includes("[Cache]") ? " Groq"
                            : modeloLLM.includes("Groq") || modeloLLM.includes("freebuff") ? " IA Real"
                            : " Fallback local"}
                        </span>
                      </span>
                    </div>`;

c = c.replace(oldSection, newSection);
writeFileSync(path, c, 'utf8');
console.log("IA badge section replaced with inline-styled dot!");
