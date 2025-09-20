import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');

const filesToValidate = [
  'rosters.json',
  'schedule.json',
  'games/index.json'
];

let hasErrors = false;

for (const file of filesToValidate) {
  const filePath = path.join(dataDir, file);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    JSON.parse(content);
    console.log(`✅ ${file} is valid JSON`);
  } catch (error) {
    console.error(`❌ ${file} is invalid JSON: ${error.message}`);
    hasErrors = true;
  }
}

if (hasErrors) {
  process.exit(1);
} else {
  console.log('All data files are valid JSON.');
}