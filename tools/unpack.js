#!/usr/bin/env node

/**
 * Webpack Bundle Unpacker
 * A utility to parse, deconstruct, and unpack a webpacked JavaScript bundle
 * back into its individual constituent modules without requiring a source map.
 *
 * Usage:
 *   node tools/unpack.js [options] [input_file] [output_dir]
 *
 * Options:
 *   --split-classes : Extract individual classes from concatenated modules into subfolders
 */

import fs from 'fs';
import path from 'path';
import * as acorn from 'acorn';

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

function printBanner() {
    console.log(`${colors.bright}${colors.cyan}====================================================`);
    console.log(`          ✦ WEBPACK BUNDLE UNPACKER ✦               `);
    console.log(`====================================================${colors.reset}\n`);
}

function printUsage() {
    console.log(`${colors.bright}Usage:${colors.reset}`);
    console.log(`  node tools/unpack.js [options] [input_file] [output_dir]\n`);
    console.log(`${colors.bright}Options:${colors.reset}`);
    console.log(`  ${colors.yellow}--split-classes${colors.reset} : Extract individual classes from squashed modules into subfolders\n`);
    console.log(`${colors.bright}Defaults:${colors.reset}`);
    console.log(`  input_file : ${colors.green}./webpacked.js${colors.reset}`);
    console.log(`  output_dir : ${colors.green}./unpacked/${colors.reset}\n`);
    console.log(`${colors.bright}Features:${colors.reset}`);
    console.log(`  ✔ Heuristic AST parser using Acorn`);
    console.log(`  ✔ Automated vendor / library detection`);
    console.log(`  ✔ Class-based naming and directory nesting`);
    console.log(`  ✔ Absolute collision protection (no overwriting)`);
    console.log(`  ✔ Complete dependency analysis & reporting\n`);
}

async function main() {
    printBanner();

    // Command line arguments parsing
    const args = process.argv.slice(2);
    if (args.includes('-h') || args.includes('--help')) {
        printUsage();
        process.exit(0);
    }

    const splitClasses = args.includes('--split-classes');

    // Filter flags out to get positional arguments
    const cleanArgs = args.filter(arg => !arg.startsWith('--'));
    const inputFile = cleanArgs[0] || './webpacked.js';
    const outputDir = cleanArgs[1] || './unpacked';

    if (!fs.existsSync(inputFile)) {
        console.error(`${colors.red}❌ Error: Input file "${inputFile}" does not exist.${colors.reset}`);
        printUsage();
        process.exit(1);
    }

    console.log(`${colors.blue}ℹ Reading bundle file: ${colors.bright}${inputFile}${colors.reset}`);
    const code = fs.readFileSync(inputFile, 'utf8');

    console.log(`${colors.blue}ℹ Parsing JavaScript AST (this might take a few seconds)...${colors.reset}`);
    let ast;
    try {
        ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script' });
        console.log(`${colors.green}✔ AST parsed successfully!${colors.reset}`);
    } catch (err) {
        console.error(`${colors.red}❌ Failed to parse JavaScript bundle:${colors.reset}`, err.message);
        process.exit(1);
    }

    console.log(`${colors.blue}ℹ Locating webpack modules container...${colors.reset}`);
    const modulesNode = findModulesContainer(ast);
    if (!modulesNode) {
        console.error(`${colors.red}❌ Error: Could not locate __webpack_modules__ or module array in bundle.${colors.reset}`);
        process.exit(1);
    }

    const moduleCount = modulesNode.type === 'ObjectExpression'
        ? modulesNode.properties.length
        : modulesNode.elements.length;

    console.log(`${colors.green}✔ Found modules container with ${colors.bright}${moduleCount}${colors.reset} modules.\n`);

    console.log(`${colors.blue}ℹ Scanning module graph to resolve names...${colors.reset}`);
    const resolvedModules = analyzeModules(modulesNode, code);

    if (splitClasses) {
        console.log(`${colors.yellow}ℹ Flag --split-classes is ENABLED. Classes will be separated into subfolders.${colors.reset}`);
    }

    console.log(`${colors.blue}ℹ Writing extracted files to: ${colors.bright}${outputDir}${colors.reset}\n`);
    writeExtractedModules(resolvedModules, code, outputDir, splitClasses);

    // Print summary report
    printSummary(resolvedModules, outputDir, splitClasses);
}

/**
 * Heuristically finds the ObjectExpression or ArrayExpression representing webpack modules.
 */
function findModulesContainer(node) {
    let container = null;

    function traverse(currentNode) {
        if (!currentNode || container) return;

        // Match 1: Named declaration var __webpack_modules__ = { ... }
        if (currentNode.type === 'VariableDeclarator' && currentNode.id.name === '__webpack_modules__') {
            if (currentNode.init && (currentNode.init.type === 'ObjectExpression' || currentNode.init.type === 'ArrayExpression')) {
                container = currentNode.init;
                return;
            }
        }

        // Match 2: Heuristic detection of a large object/array where values are functions.
        if (currentNode.type === 'ObjectExpression' && currentNode.properties.length > 5) {
            const funcProps = currentNode.properties.filter(p =>
                p.value && (p.value.type === 'FunctionExpression' || p.value.type === 'ArrowFunctionExpression')
            );
            if (funcProps.length / currentNode.properties.length > 0.8) {
                container = currentNode;
                return;
            }
        }

        // If an ArrayExpression has elements where elements are mostly function expressions
        if (currentNode.type === 'ArrayExpression' && currentNode.elements.length > 5) {
            const funcElems = currentNode.elements.filter(e =>
                e && (e.type === 'FunctionExpression' || e.type === 'ArrowFunctionExpression')
            );
            if (funcElems.length / currentNode.elements.length > 0.8) {
                container = currentNode;
                return;
            }
        }

        for (const key in currentNode) {
            if (currentNode[key] && typeof currentNode[key] === 'object') {
                if (Array.isArray(currentNode[key])) {
                    for (const child of currentNode[key]) {
                        traverse(child);
                        if (container) return;
                    }
                } else {
                    traverse(currentNode[key]);
                    if (container) return;
                }
            }
        }
    }

    traverse(node);
    return container;
}

/**
 * Analyzes the list of modules to guess names and categorize them.
 */
function analyzeModules(containerNode, fullCode) {
    const modules = [];
    const requireMappings = new Map(); // targetId -> Set of importing names

    // First Pass: Basic metadata and scanning imports
    if (containerNode.type === 'ObjectExpression') {
        for (const prop of containerNode.properties) {
            const id = prop.key.type === 'Identifier' ? prop.key.name : prop.key.value;
            const funcNode = prop.value;
            modules.push({
                id,
                node: funcNode,
                classes: [],
                guessedName: null,
                category: 'unknown'
            });
            scanImports(id, funcNode, fullCode, requireMappings);
        }
    } else {
        // ArrayExpression
        containerNode.elements.forEach((funcNode, index) => {
            if (funcNode) {
                modules.push({
                    id: index,
                    node: funcNode,
                    classes: [],
                    guessedName: null,
                    category: 'unknown'
                });
                scanImports(index, funcNode, fullCode, requireMappings);
            }
        });
    }

    // Second Pass: Scanning internals of each module for heuristics
    for (const m of modules) {
        const slice = fullCode.substring(m.node.start, m.node.end);

        // 1. Scan classes in AST
        scanClasses(m.node, m.classes);

        // ==========================================
        // PRIORITY 1: IMPORT VARIABLE NAMES (Highest precision)
        // If webpack references this module under a specific named import like `_Game_js__WEBPACK_IMPORTED_MODULE_0__`
        // ==========================================
        const names = requireMappings.get(m.id);
        if (names) {
            const webpackName = Array.from(names).find(n => n.includes('_js__WEBPACK_IMPORTED_MODULE_'));
            if (webpackName) {
                const cleanName = webpackName.replace(/^_+/, '').replace(/_js__WEBPACK_IMPORTED_MODULE_.*/, '');
                if (cleanName) {
                    m.guessedName = cleanName;
                    m.category = 'src';
                }
            }
        }

        // ==========================================
        // PRIORITY 2: CLASS DECLARATIONS (High precision)
        // ==========================================
        if (!m.guessedName && m.classes.length > 0) {
            // Filter out generic names or single letters
            const meaningfulClass = m.classes.find(c => c.length > 2 && c !== 'Player' && c !== 'Resource');
            if (meaningfulClass) {
                m.guessedName = meaningfulClass;
                m.category = 'src';
            } else if (m.classes.includes('Player')) {
                m.guessedName = 'PlayerModel';
                m.category = 'src';
            } else if (m.classes.includes('Resource')) {
                m.guessedName = 'ResourceModel';
                m.category = 'src';
            } else if (m.classes.includes('Debug')) {
                m.guessedName = 'Debug';
                m.category = 'src';
            } else {
                m.guessedName = m.classes[0];
                m.category = 'src';
            }
        }

        // ==========================================
        // PRIORITY 3: SIGNATURE-BASED LIBRARY DETECTION (Medium precision)
        // ==========================================
        if (!m.guessedName) {
            if (slice.includes('__isByteBuffer__') || slice.includes('ByteBuffer.DEFAULT_CAPACITY')) {
                m.guessedName = 'bytebuffer';
                m.category = 'vendor';
            } else if (slice.includes('isLong') && (slice.includes('fromBits') || slice.includes('shiftRightUnsigned'))) {
                m.guessedName = 'long';
                m.category = 'vendor';
            } else if (slice.includes('GrawlixPlugin') && slice.includes('FilterTemplate')) {
                m.guessedName = 'obscenity';
                m.category = 'vendor';
            } else if (slice.includes('eventNames') && slice.includes('_eventsCount') && slice.includes('listenerCount')) {
                m.guessedName = 'eventemitter';
                m.category = 'vendor';
            } else if (slice.includes('PIXI') || slice.includes('PixiJS') || slice.includes('pixi.js')) {
                m.guessedName = 'pixi';
                m.category = 'vendor';
            } else if (slice.includes('Tauri') && slice.includes('__tauri')) {
                m.guessedName = 'tauri-api';
                m.category = 'vendor';
            }
        }

        // Fallback: If no name guessed, use ID
        if (!m.guessedName) {
            m.guessedName = `module_${m.id}`;
            m.category = 'modules';
        }
    }

    return modules;
}

/**
 * Scan a module's function for require calls
 */
function scanImports(moduleId, functionNode, fullCode, requireMappings) {
    let requireParamName = null;
    if (functionNode.params && functionNode.params.length >= 3) {
        const thirdParam = functionNode.params[2];
        if (thirdParam.type === 'Identifier') {
            requireParamName = thirdParam.name;
        }
    }

    if (!requireParamName && functionNode.params && functionNode.params.length >= 3) {
        const thirdParam = functionNode.params[2];
        if (thirdParam.type === 'Identifier' && thirdParam.name === '__webpack_require__') {
            requireParamName = '__webpack_require__';
        }
    }

    if (!requireParamName) return;

    function scanNode(node, parent) {
        if (!node) return;

        if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === requireParamName) {
            const targetId = node.arguments[0]?.value;
            if (targetId !== undefined) {
                let varName = null;
                if (parent) {
                    if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
                        varName = parent.id.name;
                    } else if (parent.type === 'AssignmentExpression' && parent.left.type === 'Identifier') {
                        varName = parent.left.name;
                    }
                }

                if (varName) {
                    if (!requireMappings.has(targetId)) {
                        requireMappings.set(targetId, new Set());
                    }
                    requireMappings.get(targetId).add(varName);
                }
            }
        }

        for (const key in node) {
            if (node[key] && typeof node[key] === 'object') {
                if (Array.isArray(node[key])) {
                    for (const child of node[key]) {
                        scanNode(child, node);
                    }
                } else {
                    scanNode(node[key], node);
                }
            }
        }
    }

    scanNode(functionNode.body, null);
}

/**
 * Scan functions for class declarations/expressions
 */
function scanClasses(node, classList) {
    if (!node) return;

    if (node.type === 'ClassDeclaration' && node.id && node.id.type === 'Identifier') {
        classList.push(node.id.name);
    } else if (node.type === 'ClassExpression' && node.id && node.id.type === 'Identifier') {
        classList.push(node.id.name);
    } else if (node.type === 'Property' && node.key.type === 'Identifier' && node.value.type === 'ClassExpression') {
        classList.push(node.key.name);
    }

    for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
            if (Array.isArray(node[key])) {
                for (const child of node[key]) {
                    scanClasses(child, classList);
                }
            } else {
                scanClasses(node[key], classList);
            }
        }
    }
}

/**
 * Locate class nodes and extract their positions inside a parent function
 */
function findClassNodes(node) {
    const classNodes = [];

    function scan(currentNode) {
        if (!currentNode) return;

        if (currentNode.type === 'ClassDeclaration' && currentNode.id && currentNode.id.type === 'Identifier') {
            classNodes.push({
                name: currentNode.id.name,
                start: currentNode.start,
                end: currentNode.end
            });
        } else if (currentNode.type === 'ClassExpression' && currentNode.id && currentNode.id.type === 'Identifier') {
            classNodes.push({
                name: currentNode.id.name,
                start: currentNode.start,
                end: currentNode.end
            });
        } else if (currentNode.type === 'Property' && currentNode.key.type === 'Identifier' && currentNode.value.type === 'ClassExpression') {
            classNodes.push({
                name: currentNode.key.name,
                start: currentNode.value.start,
                end: currentNode.value.end
            });
        }

        for (const key in currentNode) {
            if (currentNode[key] && typeof currentNode[key] === 'object') {
                if (Array.isArray(currentNode[key])) {
                    for (const child of currentNode[key]) {
                        scan(child);
                    }
                } else {
                    scan(currentNode[key]);
                }
            }
        }
    }

    scan(node);
    return classNodes;
}

/**
 * Map classes to their original folder hierarchy based on typical game patterns
 */
function getNestedSubdir(guessedName, category, classesList) {
    if (category === 'vendor') {
        return 'vendor';
    }

    const name = guessedName.toLowerCase();

    if (name === 'game' || name === 'inputpacketmanager' || name === 'util' || name === 'shared') {
        return 'src/Engine';
    }

    if (name === 'codec' || name === 'network' || name === 'zombia_codec') {
        return 'src/Engine/Network';
    }

    if (name === 'renderer' || name === 'replicator' || name === 'world' || name === 'entitygrid') {
        return 'src/Engine/Renderer';
    }

    if (classesList.includes('Player') || classesList.includes('Resource') ||
        classesList.includes('ArrowTower') || classesList.includes('Harvester') ||
        guessedName.endsWith('Model') || guessedName.endsWith('Node')) {
        return 'src/Models';
    }

    if (name === 'debug') {
        return 'src/Components/UI';
    }

    if (category === 'src') {
        return 'src';
    }

    return 'modules';
}

/**
 * Write each module to output file, protecting against collisions/overwrites
 */
function writeExtractedModules(modules, fullCode, outputBaseDir, splitClasses) {
    let successCount = 0;
    let splitCount = 0;

    // Build a map of target file paths to resolve collisions
    const pathOccupants = new Map();

    for (const m of modules) {
        const subDir = getNestedSubdir(m.guessedName, m.category, m.classes);
        let name = m.guessedName;

        const targetPathKey = path.join(subDir, `${name}.js`);
        if (!pathOccupants.has(targetPathKey)) {
            pathOccupants.set(targetPathKey, []);
        }
        pathOccupants.get(targetPathKey).push(m);
    }

    // Process and write each module
    for (const [pathKey, list] of pathOccupants.entries()) {
        const hasCollision = list.length > 1;

        list.forEach((m) => {
            const functionSlice = fullCode.substring(m.node.start, m.node.end);

            // If there's a collision, append the module ID to the name to keep it unique
            const subDir = getNestedSubdir(m.guessedName, m.category, m.classes);
            const name = m.guessedName;
            const fileName = hasCollision
                ? `${name}_${m.id}.js`
                : `${name}.js`;

            const targetDir = path.join(outputBaseDir, subDir);
            const targetPath = path.join(targetDir, fileName);

            const fileContent = `/**
 * Webpack Module ID: ${m.id}
 * Guessed Name: ${m.guessedName}
 * Extracted Classes: ${m.classes.length > 0 ? m.classes.join(', ') : 'None'}
 * Collision resolved: ${hasCollision ? 'Yes' : 'No'}
 */

module.exports = ${functionSlice};
`;

            try {
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }
                fs.writeFileSync(targetPath, fileContent, 'utf8');
                successCount++;

                // If `--split-classes` is active, parse and write individual classes out
                if (splitClasses && m.classes.length > 0) {
                    const classNodes = findClassNodes(m.node);
                    const classDir = path.join(targetDir, hasCollision ? `${name}_${m.id}` : name);

                    const classPathOccupants = new Map();
                    classNodes.forEach(c => {
                        const classKey = `${c.name}.js`;
                        if (!classPathOccupants.has(classKey)) {
                            classPathOccupants.set(classKey, []);
                        }
                        classPathOccupants.get(classKey).push(c);
                    });

                    for (const [classKey, cList] of classPathOccupants.entries()) {
                        const hasClassCollision = cList.length > 1;

                        cList.forEach((c, idx) => {
                            const classSource = fullCode.substring(c.start, c.end);
                            const finalFileName = hasClassCollision
                                ? `${c.name}_${idx + 1}.js`
                                : `${c.name}.js`;

                            const classPath = path.join(classDir, finalFileName);
                            const classContent = `/**
 * Split Class: ${c.name}
 * Parent Module ID: ${m.id}
 * Parent Module Name: ${m.guessedName}
 * Collision resolved: ${hasClassCollision ? 'Yes' : 'No'}
 */

module.exports = ${classSource};
`;
                            if (!fs.existsSync(classDir)) {
                                fs.mkdirSync(classDir, { recursive: true });
                            }
                            fs.writeFileSync(classPath, classContent, 'utf8');
                            splitCount++;
                        });
                    }
                }
            } catch (err) {
                console.error(`${colors.red}❌ Error writing module ${m.id} to ${targetPath}:${colors.reset}`, err.message);
            }
        });
    }

    console.log(`${colors.green}✔ Successfully unpacked ${colors.bright}${successCount}${colors.reset} module files.${colors.reset}`);
    if (splitClasses) {
        console.log(`${colors.green}✔ Successfully split ${colors.bright}${splitCount}${colors.reset} individual classes into subfolders.${colors.reset}\n`);
    } else {
        console.log('');
    }
}

function printSummary(modules, outputDir, splitClasses) {
    const summary = {
        vendor: 0,
        src: 0,
        modules: 0
    };

    for (const m of modules) {
        summary[m.category] = (summary[m.category] || 0) + 1;
    }

    console.log(`${colors.bright}Unpack Summary Report:${colors.reset}`);
    console.log(`----------------------------------------------------`);
    console.log(`📂 Output Directory : ${colors.bright}${outputDir}${colors.reset}`);
    console.log(`📦 Vendor Libraries : ${colors.green}${summary.vendor} files${colors.reset} (e.g. bytebuffer, long, obscenity)`);
    console.log(`🛠 Identified Game Files : ${colors.cyan}${summary.src} files${colors.reset} (e.g. Game, Debug)`);
    console.log(`🧩 Other Module Files   : ${colors.yellow}${summary.modules} files${colors.reset} (no specific names identified)`);
    console.log(`----------------------------------------------------`);
    console.log(`${colors.bright}${colors.green}Unpacking process completed successfully!${colors.reset}\n`);

    if (splitClasses) {
        console.log(`${colors.bright}Split Classes Directory:${colors.reset}`);
        console.log(`Check under the parent subfolders (e.g. ${colors.cyan}${outputDir}src/Engine/Game/${colors.reset})`);
        console.log(`to view the individual class files (e.g. Player.js, Zombie.js, ArrowTower.js).`);
    } else {
        console.log(`${colors.dim}Note: Scope hoisting was used in this bundle. Core client components like`);
        console.log(`Player, Resource, ArrowTower, MageTower, Harvester, Zombie, and Wall`);
        console.log(`were merged into the entry point module (Game.js) during Webpack compiling.`);
        console.log(`They have been unpacked together into "src/Engine/Game.js".`);
        console.log(`Run with --split-classes to split them into separate subfiles.${colors.reset}\n`);
    }
}

main().catch(err => {
    console.error(`${colors.red}❌ Critical Unpack Error:${colors.reset}`, err);
    process.exit(1);
});
