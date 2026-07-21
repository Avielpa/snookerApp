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

const plistPath = path.join(__dirname, 'GoogleService-Info.plist');
const plistContent = '<plist version="1.0"><dict><key>API_KEY</key><string>test</string></dict></plist>';
process.env.GOOGLE_SERVICE_INFO_PLIST_BASE64 = Buffer.from(plistContent).toString('base64');

const appConfigPath = path.join(__dirname, 'app.config.js');
delete require.cache[require.resolve(appConfigPath)];
const config = require(appConfigPath);

assert.equal(config.expo.ios.googleServicesFile, './GoogleService-Info.plist');
assert.ok(fs.existsSync(plistPath));
assert.match(fs.readFileSync(plistPath, 'utf8'), /<plist/);

console.log('✅ ads config test passed');
