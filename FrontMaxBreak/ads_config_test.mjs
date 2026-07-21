import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'));
assert.equal(
  appJson.expo.ios.infoPlist.GADApplicationIdentifier,
  'ca-app-pub-7026436404209900~7553262356'
);

// app.config.js writes GoogleService-Info.plist to this exact path whenever
// GOOGLE_SERVICE_INFO_PLIST_BASE64 is set — a real plist may already exist here
// (a developer's actual Firebase config), so back it up and restore it after
// the test instead of clobbering it.
const plistPath = path.join(__dirname, 'GoogleService-Info.plist');
const originalPlist = fs.existsSync(plistPath) ? fs.readFileSync(plistPath, 'utf8') : null;

try {
  const plistContent = '<plist version="1.0"><dict><key>API_KEY</key><string>test</string></dict></plist>';
  process.env.GOOGLE_SERVICE_INFO_PLIST_BASE64 = Buffer.from(plistContent).toString('base64');

  const appConfigPath = path.join(__dirname, 'app.config.js');
  delete require.cache[require.resolve(appConfigPath)];
  const config = require(appConfigPath);

  assert.equal(config.expo.ios.googleServicesFile, './GoogleService-Info.plist');
  assert.ok(fs.existsSync(plistPath));
  assert.match(fs.readFileSync(plistPath, 'utf8'), /<plist/);
} finally {
  delete process.env.GOOGLE_SERVICE_INFO_PLIST_BASE64;
  if (originalPlist !== null) {
    fs.writeFileSync(plistPath, originalPlist, { encoding: 'utf8' });
  } else if (fs.existsSync(plistPath)) {
    fs.unlinkSync(plistPath);
  }
}

console.log('✅ ads config test passed');
