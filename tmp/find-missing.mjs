import { readFileSync } from 'fs';
const c = readFileSync('src/lib/api-mundiais.ts', 'utf8');
const lines = c.split('\n');
console.log('Total lines:', lines.length);

// Check for key function signatures
const funcs = [
  'fetchComTimeout', 'fetchUSGS', 'fetchGDACS', 'fetchCemaden',
  'fetchNasaFirms', 'fetchEMSC', 'fetchUSGSVolcanoes', 
  'fetchOpenFEMA', 'fetchCopernicusEMS', 'fetchNOAANHC',
  'fetchNwsTsunami', 'fetchOWM', 'fetchWeatherAPI',
  'fetchEstacoesINMET', 'fetchINMETPrecip', 'fetchOpenMeteo',
  'converterDadosParaEventos', 'extrairPais'
];

for (const f of funcs) {
  const idx = c.indexOf('async function ' + f);
  if (idx >= 0) {
    console.log('✅ ' + f + ' found');
  } else {
    console.log('❌ ' + f + ' MISSING');
  }
}

// Also check fetch functions used in buscarDadosMundiais
const directFuncs = ['fetchUSGS', 'fetchOWM', 'fetchWeatherAPI', 'fetchOpenMeteo', 'fetchINMETPrecip', 'fetchCemaden'];
for (const f of directFuncs) {
  const idx = c.indexOf(f + '(');
  if (idx >= 0) {
    console.log('✅  Call to ' + f + ' found');
  } else {
    console.log('❌  Call to ' + f + ' MISSING');
  }
}
