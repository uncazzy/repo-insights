#!/usr/bin/env node

import { writeFileSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { collectData } from '../lib/collect-data.mjs';
import { generateReport } from '../lib/generate-report.mjs';

const args = process.argv.slice(2);
const shouldOpen = args.includes('--open');

console.log('\n  repo-insights v1.0.0\n');
console.log('  Collecting data...');

const data = await collectData((section, status, error) => {
  if (status === 'start') {
    process.stdout.write(`    ${section}...`);
  } else if (status === 'done') {
    process.stdout.write(' done\n');
  } else if (status === 'error') {
    process.stdout.write(` ERROR: ${error}\n`);
  }
});

const cwd = process.cwd();
const jsonPath = join(cwd, 'repo-insights.json');
const htmlPath = join(cwd, 'report.html');

writeFileSync(jsonPath, JSON.stringify(data, null, 2));

console.log('  Generating report...');
const html = generateReport(data);
writeFileSync(htmlPath, html);

console.log(`\n  Done! Open report.html to view your report.\n`);

if (shouldOpen) {
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open'
    : platform === 'win32' ? 'start ""'
    : 'xdg-open';
  exec(`${cmd} "${htmlPath}"`, (err) => {
    if (err) console.error(`  Could not auto-open: ${err.message}`);
  });
}
