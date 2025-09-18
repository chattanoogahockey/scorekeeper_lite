import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { gameSchema } from '../js/core/schema.js';

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const scriptsDir = path.dirname(__filename);
  const projectRoot = path.resolve(scriptsDir, '..');
  const gamesDir = path.join(projectRoot, 'data', 'games');
  const errors = [];

  const gamesDirExists = await exists(gamesDir);
  if (!gamesDirExists) {
    console.log('No data/games directory yet. Skipping validation.');
    return;
  }

  const indexPath = path.join(gamesDir, 'index.json');
  const indexEntries = await readIndex(indexPath, errors);
  const gameFiles = await listGameFiles(gamesDir);

  for (const file of gameFiles) {
    const fullPath = path.join(gamesDir, file);
    const raw = await fs.readFile(fullPath, 'utf8');

    try {
      const parsed = JSON.parse(raw);
      gameSchema.parse(parsed);
    } catch (error) {
      errors.push(`Game file ${file} failed validation: ${error}`);
    }
  }

  if (indexEntries) {
    const indexIds = new Set(indexEntries.map((entry) => entry.id));
    const fileIds = new Set(gameFiles.map((file) => path.parse(file).name));

    for (const id of indexIds) {
      if (!fileIds.has(id)) {
        errors.push(`Index entry ${id} has no matching game file.`);
      }
    }
  }

  if (errors.length) {
    console.error('Validation failed:');
    errors.forEach((message) => console.error(` - ${message}`));
    process.exitCode = 1;
    return;
  }

  console.log(`Validated ${gameFiles.length} game file(s).`);
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readIndex(indexPath, errors) {
  const indexExists = await exists(indexPath);
  if (!indexExists) {
    return null;
  }

  try {
    const raw = await fs.readFile(indexPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('index.json must be an array');
    }
    return parsed;
  } catch (error) {
    errors.push(`Failed to read index.json: ${error}`);
    return null;
  }
}

async function listGameFiles(gamesDir) {
  const dirEntries = await fs.readdir(gamesDir, { withFileTypes: true });
  return dirEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json')
    .map((entry) => entry.name);
}

main().catch((error) => {
  console.error('Unexpected error during validation', error);
  process.exitCode = 1;
});