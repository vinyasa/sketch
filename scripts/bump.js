import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';

const versionFilePath = path.resolve('src/version.json');
const rawData = fs.readFileSync(versionFilePath);
const versionData = JSON.parse(rawData);

// 1. Calculate Date-based CalVer YY.MM.DD
const today = new Date();
const yy = String(today.getFullYear()).slice(-2);
const mm = String(today.getMonth() + 1).padStart(2, '0');
const dd = String(today.getDate()).padStart(2, '0');
const calVerSuffix = `${yy}.${mm}.${dd}`;

// 2. Parse current major/minor baseline (e.g. "0.8" from "0.8.26.05.29")
const versionParts = versionData.version.split('.');
const currentBase = `${versionParts[0]}.${versionParts[1]}`; // e.g. "0.8"

// 3. Propose new version
const defaultNewVersion = `${currentBase}.${calVerSuffix}`;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log(`\n⚙️  Current Version: \x1b[36m${versionData.version}\x1b[0m`);
console.log(`👉 Proposed Version: \x1b[32m${defaultNewVersion}\x1b[0m (Keeping ${currentBase} baseline with current date ${calVerSuffix})`);

rl.question(`\nPress [ENTER] to accept, or enter custom version (e.g. 0.9.${calVerSuffix}): `, (input) => {
    const finalVersion = input.trim() || defaultNewVersion;
    
    // Update version file
    versionData.version = finalVersion;
    versionData.releasedAt = today.toISOString().split('T')[0];
    
    fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2) + '\n');
    console.log(`\n✅ Updated version.json to \x1b[32m${finalVersion}\x1b[0m!`);
    
    // Automate Git commands
    try {
        console.log('🐙 Committing changes to git...');
        execSync(`git add ${versionFilePath}`);
        execSync(`git commit -m "chore(release): bump version to v${finalVersion}"`);
        console.log(`🏷️  Creating git tag v${finalVersion}...`);
        execSync(`git tag -a v${finalVersion} -m "Release v${finalVersion}"`);
        
        console.log(`\n\x1b[35m🚀 Version bumped successfully!\x1b[0m`);
        console.log(`Next step: Run \x1b[33mgit push origin main --tags\x1b[0m to push commits and tags to GitHub!`);
    } catch (err) {
        console.error('\n⚠️ Git automation failed. Please commit and tag manually:', err.message);
    }
    
    rl.close();
});
