#!/usr/bin/env node

/**
 * Zombia Client Multi-Platform Build & Exporter Tool
 * Builds the Tauri application for Windows, macOS, and Linux, and exports to /dist.
 * 
 * Usage:
 *   node tools/build.js [macos | windows | linux | all]
 */

import fs from 'fs';
import path from 'path';
import { spawnSync, spawn } from 'child_process';

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

function printBanner() {
    console.log(`${colors.bright}${colors.cyan}====================================================`);
    console.log(`         ✦ MULTI-PLATFORM BUILD RUNNER ✦             `);
    console.log(`====================================================${colors.reset}\n`);
}

function printUsage() {
    console.log(`${colors.bright}Usage:${colors.reset}`);
    console.log(`  node tools/build.js [platform]\n`);
    console.log(`${colors.bright}Platforms:${colors.reset}`);
    console.log(`  macos        Build macOS app & DMG installer (native only)`);
    console.log(`  windows      Build Windows MSI/NSIS installers (native, or cross-compile via cargo-xwin)`);
    console.log(`  linux        Build Linux DEB/AppImage (native, or cross-compile via Docker)`);
    console.log(`  all          Attempt builds for all 3 platforms using available pipelines`);
    console.log(`  (empty)      Defaults to the current host platform\n`);
}

// Helper to check if a command exists in the system PATH
function commandExists(cmd) {
    const isWindows = process.platform === 'win32';
    const checkCmd = isWindows ? `where ${cmd}` : `which ${cmd}`;
    const result = spawnSync(isWindows ? 'cmd' : 'sh', [isWindows ? '/c' : '-c', checkCmd]);
    return result.status === 0;
}

// Helper to run a command with live streaming of output
function runCommand(command, args, cwd = process.cwd()) {
    return new Promise((resolve) => {
        console.log(`${colors.blue}➔ Running: ${colors.bright}${command} ${args.join(' ')}${colors.reset}`);
        
        const child = spawn(command, args, { 
            cwd, 
            stdio: 'inherit',
            shell: true 
        });

        child.on('close', (code) => {
            resolve(code === 0);
        });

        child.on('error', (err) => {
            console.error(`${colors.red}❌ Error executing command:${colors.reset}`, err.message);
            resolve(false);
        });
    });
}

// Clean and recreate a directory
function setupDir(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
    }
    fs.mkdirSync(dirPath, { recursive: true });
}

// Copy file helper
function copyFile(src, dest) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
    console.log(`${colors.green}✔ Exported: ${colors.reset}${path.basename(src)} ➔ ${colors.dim}${path.relative(process.cwd(), dest)}${colors.reset}`);
}

// Copy directory helper
function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    setupDir(dest);
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
            console.log(`${colors.green}✔ Exported: ${colors.reset}${entry.name} ➔ ${colors.dim}${path.relative(process.cwd(), destPath)}${colors.reset}`);
        }
    }
}

// Recursively search for files matching extensions in the target directory
function findArtifacts(dir, extensions, list = []) {
    if (!fs.existsSync(dir)) return list;
    
    // Ignore build/target directories we know don't contain final bundles to avoid duplicates
    if (dir.includes('/target/debug') || dir.includes('/.fingerprint') || dir.includes('/build/') || dir.includes('/deps/')) {
        return list;
    }

    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            // Recurse into directories (but avoid bundle dirs if we already copied the whole bundle)
            findArtifacts(filePath, extensions, list);
        } else {
            const ext = path.extname(file).toLowerCase();
            if (extensions.includes(ext)) {
                list.push(filePath);
            }
        }
    }
    return list;
}

// Find and copy directories matching specific names (e.g. .app bundles for macOS)
function findAndCopyAppBundles(targetDir, destDir) {
    if (!fs.existsSync(targetDir)) return;
    const items = fs.readdirSync(targetDir);
    for (const item of items) {
        const fullPath = path.join(targetDir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && item.endsWith('.app')) {
            console.log(`${colors.blue}➔ Copying macOS .app bundle: ${colors.bright}${item}${colors.reset}`);
            copyDir(fullPath, path.join(destDir, item));
        } else if (stat.isDirectory() && !item.includes('debug') && !item.includes('fingerprint') && !item.includes('build')) {
            findAndCopyAppBundles(fullPath, destDir);
        }
    }
}

async function buildMac(distDir) {
    console.log(`${colors.bright}${colors.magenta}=== BUILDING FOR macOS ===${colors.reset}`);
    
    if (process.platform !== 'darwin') {
        console.error(`${colors.red}❌ Error: macOS bundles can only be compiled natively on a macOS machine.${colors.reset}`);
        console.log(`${colors.yellow}💡 Tip: Use our GitHub Actions CI workflow to build for macOS automatically on push or release.${colors.reset}`);
        return false;
    }

    const success = await runCommand('pnpm', ['tauri', 'build']);
    if (!success) {
        console.error(`${colors.red}❌ Tauri build failed for macOS.${colors.reset}`);
        return false;
    }

    console.log(`\n${colors.cyan}➔ Exporting macOS binaries to dist/macos/...${colors.reset}`);
    const macosDist = path.join(distDir, 'macos');
    setupDir(macosDist);

    const targetDir = path.join(process.cwd(), 'src-tauri', 'target', 'release');
    
    // Copy DMG installers
    const dmgs = findArtifacts(targetDir, ['.dmg']);
    if (dmgs.length > 0) {
        dmgs.forEach(dmg => copyFile(dmg, path.join(macosDist, path.basename(dmg))));
    } else {
        console.warn(`${colors.yellow}⚠ Warning: No .dmg files found in target folder.${colors.reset}`);
    }

    // Copy .app bundles
    findAndCopyAppBundles(targetDir, macosDist);

    return true;
}

async function buildWindows(distDir) {
    console.log(`${colors.bright}${colors.magenta}=== BUILDING FOR WINDOWS ===${colors.reset}`);
    
    const isWindows = process.platform === 'win32';
    const windowsDist = path.join(distDir, 'windows');
    setupDir(windowsDist);

    if (isWindows) {
        // Native Windows Build
        const success = await runCommand('pnpm', ['tauri', 'build']);
        if (!success) {
            console.error(`${colors.red}❌ Tauri build failed for Windows.${colors.reset}`);
            return false;
        }

        console.log(`\n${colors.cyan}➔ Exporting Windows binaries to dist/windows/...${colors.reset}`);
        const targetDir = path.join(process.cwd(), 'src-tauri', 'target', 'release');
        const installers = findArtifacts(targetDir, ['.exe', '.msi']);
        if (installers.length > 0) {
            installers.forEach(inst => copyFile(inst, path.join(windowsDist, path.basename(inst))));
        } else {
            console.warn(`${colors.yellow}⚠ Warning: No Windows installers (.exe or .msi) found.${colors.reset}`);
        }
        return true;
    } else {
        // Cross-compiling from macOS/Linux to Windows
        console.log(`${colors.yellow}ℹ Non-Windows host detected. Attempting cross-compilation to Windows via cargo-xwin/NSIS...${colors.reset}`);
        
        let checksPassed = true;
        
        // Check rustup targets
        const targetsCheck = spawnSync('rustup', ['target', 'list', '--installed']);
        const installedTargets = targetsCheck.stdout ? targetsCheck.stdout.toString() : '';
        const hasWvcTarget = installedTargets.includes('x86_64-pc-windows-msvc');
        
        if (!hasWvcTarget) {
            console.error(`${colors.red}❌ Missing Rust Target: x86_64-pc-windows-msvc is not installed.${colors.reset}`);
            checksPassed = false;
        }

        // Check cargo-xwin
        const hasCargoXwin = commandExists('cargo-xwin');
        if (!hasCargoXwin) {
            console.error(`${colors.red}❌ Missing Tool: cargo-xwin is not installed.${colors.reset}`);
            checksPassed = false;
        }

        // Check NSIS (makensis)
        const hasNsis = commandExists('makensis');
        if (!hasNsis) {
            console.error(`${colors.red}❌ Missing Tool: nsis (makensis) is not installed.${colors.reset}`);
            checksPassed = false;
        }

        // Check LLVM/Clang (required by cargo-xwin for linking)
        const hasClang = commandExists('clang') || commandExists('lld');
        if (!hasClang) {
            console.error(`${colors.red}❌ Missing Tool: LLVM/Clang compiler or linker is not installed.${colors.reset}`);
            checksPassed = false;
        }

        if (!checksPassed) {
            console.log(`\n${colors.bright}${colors.yellow}💡 How to resolve cross-compilation dependencies:${colors.reset}`);
            console.log(`  1. Install the Windows MSVC compiler target:`);
            console.log(`     ${colors.cyan}rustup target add x86_64-pc-windows-msvc${colors.reset}`);
            console.log(`  2. Install cargo-xwin (fetches Windows SDKs automatically):`);
            console.log(`     ${colors.cyan}cargo install cargo-xwin${colors.reset}`);
            console.log(`  3. Install NSIS and LLVM system linkers:`);
            if (process.platform === 'darwin') {
                console.log(`     ${colors.cyan}brew install nsis llvm${colors.reset}`);
            } else {
                console.log(`     ${colors.cyan}sudo apt-get install -y nsis llvm lld clang${colors.reset}`);
            }
            console.log(`\n${colors.red}❌ Windows cross-compilation aborted due to missing dependencies.${colors.reset}`);
            console.log(`${colors.yellow}💡 Alternatively, push to GitHub to build Windows artifacts via CI automatically.${colors.reset}`);
            return false;
        }

        console.log(`${colors.green}✔ All cross-compilation dependencies checked and available.${colors.reset}`);
        
        // Execute cross-compilation
        const success = await runCommand('pnpm', [
            'tauri', 
            'build', 
            '--target', 'x86_64-pc-windows-msvc', 
            '--runner', 'cargo-xwin'
        ]);

        if (!success) {
            console.error(`${colors.red}❌ Windows cross-compilation failed.${colors.reset}`);
            return false;
        }

        console.log(`\n${colors.cyan}➔ Exporting cross-compiled Windows binaries to dist/windows/...${colors.reset}`);
        const targetDir = path.join(process.cwd(), 'src-tauri', 'target', 'x86_64-pc-windows-msvc', 'release');
        const installers = findArtifacts(targetDir, ['.exe', '.msi']);
        if (installers.length > 0) {
            installers.forEach(inst => copyFile(inst, path.join(windowsDist, path.basename(inst))));
        } else {
            console.warn(`${colors.yellow}⚠ Warning: No Windows installers (.exe or .msi) found in the cross-compiled output folder.${colors.reset}`);
        }
        return true;
    }
}

async function buildLinux(distDir) {
    console.log(`${colors.bright}${colors.magenta}=== BUILDING FOR LINUX ===${colors.reset}`);
    
    const isLinux = process.platform === 'linux';
    const linuxDist = path.join(distDir, 'linux');
    setupDir(linuxDist);

    if (isLinux) {
        // Native Linux Build
        const success = await runCommand('pnpm', ['tauri', 'build']);
        if (!success) {
            console.error(`${colors.red}❌ Tauri build failed for Linux.${colors.reset}`);
            return false;
        }

        console.log(`\n${colors.cyan}➔ Exporting Linux binaries to dist/linux/...${colors.reset}`);
        const targetDir = path.join(process.cwd(), 'src-tauri', 'target', 'release');
        const installers = findArtifacts(targetDir, ['.deb', '.appimage']);
        if (installers.length > 0) {
            installers.forEach(inst => copyFile(inst, path.join(linuxDist, path.basename(inst))));
        } else {
            console.warn(`${colors.yellow}⚠ Warning: No Linux installers (.deb or .AppImage) found.${colors.reset}`);
        }
        return true;
    } else {
        // Build Linux via Docker from Mac/Windows host
        console.log(`${colors.yellow}ℹ Non-Linux host detected. Attempting to build Linux binaries via Docker...${colors.reset}`);
        
        if (!commandExists('docker')) {
            console.error(`${colors.red}❌ Missing Tool: Docker is not installed or not in system PATH.${colors.reset}`);
            console.log(`\n${colors.bright}${colors.yellow}💡 How to resolve:${colors.reset}`);
            console.log(`  1. Install Docker Desktop (https://www.docker.com/products/docker-desktop/)`);
            console.log(`  2. Ensure the Docker daemon is running.`);
            console.log(`\n${colors.red}❌ Linux build via Docker aborted.${colors.reset}`);
            console.log(`${colors.yellow}💡 Alternatively, push to GitHub to build Linux binaries via CI automatically.${colors.reset}`);
            return false;
        }

        // Verify Docker daemon is running
        const dockerCheck = spawnSync('docker', ['info']);
        if (dockerCheck.status !== 0) {
            console.error(`${colors.red}❌ Error: Docker daemon is not running. Please start Docker Desktop and try again.${colors.reset}`);
            return false;
        }

        console.log(`${colors.green}✔ Docker is installed and running.${colors.reset}`);
        console.log(`${colors.blue}➔ Launching Linux build inside Node-Rust-Tauri compiler container...${colors.reset}`);
        
        // Run compiling script in an ubuntu container. We mount local path to /app.
        // It installs needed libraries, setups node/rust, and triggers build.
        // We use process.cwd() as absolute path of root folder.
        const workDir = process.cwd();
        const dockerArgs = [
            'run', '--rm',
            '-v', `${workDir}:/app`,
            '-w', '/app',
            'node:20-bookworm',
            'sh', '-c',
            'apt-get update && apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libssl-dev patchelf build-essential curl wget file && curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && . $HOME/.cargo/env && npm install -g pnpm && pnpm install --no-frozen-lockfile && pnpm tauri build'
        ];

        const success = await runCommand('docker', dockerArgs);
        if (!success) {
            console.error(`${colors.red}❌ Linux compilation inside Docker container failed.${colors.reset}`);
            return false;
        }

        console.log(`\n${colors.cyan}➔ Exporting Docker-compiled Linux binaries to dist/linux/...${colors.reset}`);
        const targetDir = path.join(process.cwd(), 'src-tauri', 'target', 'release');
        const installers = findArtifacts(targetDir, ['.deb', '.appimage']);
        if (installers.length > 0) {
            installers.forEach(inst => copyFile(inst, path.join(linuxDist, path.basename(inst))));
        } else {
            console.warn(`${colors.yellow}⚠ Warning: No Linux installers found in the target release directory.${colors.reset}`);
        }
        return true;
    }
}

async function main() {
    printBanner();

    const args = process.argv.slice(2);
    if (args.includes('-h') || args.includes('--help')) {
        printUsage();
        process.exit(0);
    }

    const platformArg = args[0] ? args[0].toLowerCase() : null;
    const distDir = path.join(process.cwd(), 'dist');

    // Clean build directory
    if (!platformArg || platformArg === 'all') {
        console.log(`${colors.cyan}➔ Cleaning export directory '/dist'...${colors.reset}`);
        setupDir(distDir);
    }

    let success = true;

    if (!platformArg) {
        // Default to host OS
        const hostOS = process.platform;
        if (hostOS === 'darwin') {
            success = await buildMac(distDir);
        } else if (hostOS === 'win32') {
            success = await buildWindows(distDir);
        } else if (hostOS === 'linux') {
            success = await buildLinux(distDir);
        } else {
            console.error(`${colors.red}❌ Unsupported host operating system: ${hostOS}${colors.reset}`);
            printUsage();
            process.exit(1);
        }
    } else if (platformArg === 'macos') {
        success = await buildMac(distDir);
    } else if (platformArg === 'windows') {
        success = await buildWindows(distDir);
    } else if (platformArg === 'linux') {
        success = await buildLinux(distDir);
    } else if (platformArg === 'all') {
        console.log(`${colors.bright}${colors.blue}★ Triggering builds for all 3 platforms ★${colors.reset}\n`);
        const macOk = await buildMac(distDir);
        console.log('\n');
        const winOk = await buildWindows(distDir);
        console.log('\n');
        const linOk = await buildLinux(distDir);
        
        success = macOk && winOk && linOk;
        
        console.log(`\n${colors.bright}${colors.cyan}====================================================`);
        console.log(`          ✦ ALL BUILD PROCESSES COMPLETE ✦           `);
        console.log(`====================================================${colors.reset}`);
        console.log(`  macOS Build : ${macOk ? colors.green + 'SUCCESS' : colors.red + 'FAILED'}${colors.reset}`);
        console.log(`  Windows Build: ${winOk ? colors.green + 'SUCCESS' : colors.red + 'FAILED'}${colors.reset}`);
        console.log(`  Linux Build  : ${linOk ? colors.green + 'SUCCESS' : colors.red + 'FAILED'}${colors.reset}\n`);
    } else {
        console.error(`${colors.red}❌ Unknown platform option: "${platformArg}"${colors.reset}`);
        printUsage();
        process.exit(1);
    }

    if (success) {
        console.log(`${colors.bright}${colors.green}🎉 Compilation complete! Find all exported assets in:${colors.reset}`);
        console.log(`   ${colors.bright}${colors.cyan}${distDir}/${colors.reset}\n`);
    } else {
        console.error(`${colors.bright}${colors.red}❌ One or more build processes failed or were skipped.${colors.reset}\n`);
        process.exit(1);
    }
}

main().catch(err => {
    console.error(`${colors.red}❌ Critical Error during build:${colors.reset}`, err);
    process.exit(1);
});
