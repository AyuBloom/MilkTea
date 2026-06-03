#!/usr/bin/env node

/**
 * Zombia Client Version Bumper
 * Syncs and bumps version numbers across:
 *  - package.json
 *  - src-tauri/tauri.conf.json
 *  - src-tauri/Cargo.toml
 *
 * Usage:
 *   node tools/bump.js [patch | minor | major | <custom-version>]
 */

import fs from 'fs';
import path from 'path';

// ANSI escape codes for premium console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    red: '\x1b[31m'
};

const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;

function printBanner() {
    console.log(`${colors.bright}${colors.cyan}====================================================`);
    console.log(`          ✦ CLIENT VERSION BUMPER ✦                  `);
    console.log(`====================================================${colors.reset}\n`);
}

function printUsage() {
    console.log(`${colors.bright}Usage:${colors.reset}`);
    console.log(`  node tools/bump.js [patch | minor | major | <custom-version>]\n`);
    console.log(`${colors.bright}Examples:${colors.reset}`);
    console.log(`  node tools/bump.js patch     (e.g., 0.6.0 -> 0.6.1)`);
    console.log(`  node tools/bump.js minor     (e.g., 0.6.0 -> 0.7.0)`);
    console.log(`  node tools/bump.js major     (e.g., 0.6.0 -> 1.0.0)`);
    console.log(`  node tools/bump.js 0.7.2     (sets version explicitly to 0.7.2)\n`);
}

function bumpVersion(currentVersion, type) {
    if (type !== 'patch' && type !== 'minor' && type !== 'major') {
        if (semverRegex.test(type)) {
            return type;
        }
        throw new Error(`Invalid version or bump type: "${type}"`);
    }

    const match = currentVersion.match(/^(\d+)\.(\d+)\.(\d+)(-.+)?$/);
    if (!match) {
        throw new Error(`Current version "${currentVersion}" in package.json is not a valid semver.`);
    }

    let major = parseInt(match[1], 10);
    let minor = parseInt(match[2], 10);
    let patch = parseInt(match[3], 10);
    const prerelease = match[4] || '';

    if (type === 'major') {
        major += 1;
        minor = 0;
        patch = 0;
    } else if (type === 'minor') {
        minor += 1;
        patch = 0;
    } else if (type === 'patch') {
        patch += 1;
    }

    return `${major}.${minor}.${patch}${prerelease}`;
}

async function main() {
    printBanner();

    const args = process.argv.slice(2);
    if (args.includes('-h') || args.includes('--help')) {
        printUsage();
        process.exit(0);
    }

    const bumpType = args[0] || 'patch';

    // Define Paths
    const rootDir = process.cwd();
    const packageJsonPath = path.join(rootDir, 'package.json');
    const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
    const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');

    // 1. Read Current Version from package.json
    if (!fs.existsSync(packageJsonPath)) {
        console.error(`${colors.red}❌ Error: package.json not found in current directory.${colors.reset}`);
        process.exit(1);
    }

    let packageJson;
    try {
        packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    } catch (err) {
        console.error(`${colors.red}❌ Error reading/parsing package.json:${colors.reset}`, err.message);
        process.exit(1);
    }

    const currentVersion = packageJson.version;
    if (!currentVersion) {
        console.error(`${colors.red}❌ Error: No version field found in package.json.${colors.reset}`);
        process.exit(1);
    }

    // 2. Determine target version
    let targetVersion;
    try {
        targetVersion = bumpVersion(currentVersion, bumpType);
    } catch (err) {
        console.error(`${colors.red}❌ Error: ${err.message}${colors.reset}`);
        printUsage();
        process.exit(1);
    }

    console.log(`${colors.blue}ℹ Current client version : ${colors.bright}${currentVersion}${colors.reset}`);
    console.log(`${colors.blue}ℹ Target client version  : ${colors.bright}${colors.green}${targetVersion}${colors.reset}\n`);

    // 3. Update package.json
    console.log(`${colors.blue}📝 Updating package.json...${colors.reset}`);
    packageJson.version = targetVersion;
    try {
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
        console.log(`${colors.green}✔ Updated package.json successfully.${colors.reset}`);
    } catch (err) {
        console.error(`${colors.red}❌ Failed to write package.json:${colors.reset}`, err.message);
        process.exit(1);
    }

    // 4. Update src-tauri/tauri.conf.json
    if (fs.existsSync(tauriConfPath)) {
        console.log(`${colors.blue}📝 Updating src-tauri/tauri.conf.json...${colors.reset}`);
        try {
            const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
            tauriConf.version = targetVersion;
            fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf8');
            console.log(`${colors.green}✔ Updated src-tauri/tauri.conf.json successfully.${colors.reset}`);
        } catch (err) {
            console.warn(`${colors.yellow}⚠ Warning: Failed to update src-tauri/tauri.conf.json:${colors.reset}`, err.message);
        }
    } else {
        console.log(`${colors.dim}ℹ src-tauri/tauri.conf.json not found, skipping.${colors.reset}`);
    }

    // 5. Update src-tauri/Cargo.toml
    if (fs.existsSync(cargoTomlPath)) {
        console.log(`${colors.blue}📝 Updating src-tauri/Cargo.toml...${colors.reset}`);
        try {
            const cargoContent = fs.readFileSync(cargoTomlPath, 'utf8');

            // Matches `version = "0.4.0"` format specifically under [package]
            // We use a regex to swap the main version assignment.
            const updatedCargoContent = cargoContent.replace(/^version\s*=\s*"[^"]*"/m, `version = "${targetVersion}"`);

            if (cargoContent === updatedCargoContent) {
                console.warn(`${colors.yellow}⚠ Warning: Could not locate 'version = "..."' in Cargo.toml. Version not updated in Cargo.toml.${colors.reset}`);
            } else {
                fs.writeFileSync(cargoTomlPath, updatedCargoContent, 'utf8');
                console.log(`${colors.green}✔ Updated src-tauri/Cargo.toml successfully.${colors.reset}`);
            }
        } catch (err) {
            console.warn(`${colors.yellow}⚠ Warning: Failed to update src-tauri/Cargo.toml:${colors.reset}`, err.message);
        }
    } else {
        console.log(`${colors.dim}ℹ src-tauri/Cargo.toml not found, skipping.${colors.reset}`);
    }

    // Done!
    console.log(`\n${colors.bright}${colors.green}🎉 Version successfully bumped to ${targetVersion}!${colors.reset}`);
    console.log(`${colors.dim}💡 Tip: Run 'cargo check' or trigger a Tauri build to update Cargo.lock.${colors.reset}\n`);
}

main().catch(err => {
    console.error(`${colors.red}❌ Critical Error during version bump:${colors.reset}`, err);
    process.exit(1);
});
