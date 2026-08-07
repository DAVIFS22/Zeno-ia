import fs from 'fs';
import path from 'path';
import { ZENO_VERSION_HISTORY, CURRENT_ZENO_VERSION } from '../src/lib/versionSystem';

const changelogData = {
  currentVersion: CURRENT_ZENO_VERSION,
  generatedAt: new Date().toISOString(),
  history: ZENO_VERSION_HISTORY
};

const outputDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const outputPath = path.join(outputDir, 'changelog.json');
fs.writeFileSync(outputPath, JSON.stringify(changelogData, null, 2), 'utf-8');
console.log(`[ZENO VERSIONING] Changelog gerado com sucesso em ${outputPath} (v${CURRENT_ZENO_VERSION})`);
