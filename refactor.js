const fs = require('fs');
const path = require('path');

const bundleContent = fs.readFileSync(path.join(__dirname, 'bundle.js'), 'utf-8');
const lines = bundleContent.split('\n');

function extractLines(startPattern, endPattern, skipLines = 0) {
    let startIdx = lines.findIndex(l => l.includes(startPattern));
    let endIdx = endPattern ? lines.findIndex((l, idx) => idx > startIdx && l.includes(endPattern)) : lines.length;
    
    if (startIdx === -1) return [];
    
    // adjust for the // ===== lines
    startIdx += skipLines;
    if (endPattern && endIdx !== -1) {
        // usually endIdx points to the next // ======
        return lines.slice(startIdx, endIdx).map(l => l.trimRight()).filter(l => l.trim() !== '');
    }
    return lines.slice(startIdx).map(l => l.trimRight()).filter(l => l.trim() !== '');
}

function writeModule(folder, filename, imports, contentLines, exportsStr) {
    const filePath = path.join(__dirname, 'src', folder, filename);
    let out = imports.join('\n') + (imports.length ? '\n\n' : '');
    out += contentLines.join('\n') + '\n\n';
    out += exportsStr;
    
    // Check if path is empty (meaning root directory)
    const outPath = folder === '' ? path.join(__dirname, filename) : filePath;
    fs.writeFileSync(outPath, out);
    console.log(`Created ${outPath}`);
}

// 1 & 5. Utils
let utilsLines1 = extractLines('1. UTILS', '2. ROLES', 2);
let utilsLines2 = extractLines('5. MODAL HELPER', '6. ALL', 2);
let utilsCode = [...utilsLines1, ...utilsLines2].join('\n');
// Make functions exportable
let utilsExports = [];
utilsCode = utilsCode.replace(/function (escapeHTML|openModal|closeModal|showToast|formatMoney|formatDate|formatPhone|generateId|showConfirm|closeConfirm)\(/g, (match, p1) => {
    utilsExports.push(p1);
    return `function ${p1}(`;
});
writeModule('utils', 'helpers.js', [], [...utilsLines1, ...utilsLines2], `export {\n  ${utilsExports.join(',\n  ')}\n};`);

// 2. Roles
let rolesLines = extractLines('2. ROLES', '3. DATABASE', 2);
writeModule('types', 'index.js', [], rolesLines, 'export { ROLE_LABELS };');

// 3. Database
let dbLines = extractLines('3. DATABASE', '4. AUTH', 2);
writeModule('services', 'db.js', [
    `import { showToast, generateId } from '../utils/helpers.js';`,
    `import { FIREBASE_CONFIG } from '../config.js';`
], dbLines, 'export { DatabaseService, db, STORAGE_KEY };');

// 4. Auth
let authLines = extractLines('4. AUTH', '5. MODAL', 2);
writeModule('services', 'auth.js', [
    `import { db } from './db.js';`,
    `import { showToast } from '../utils/helpers.js';`,
    `import { ROLE_LABELS } from '../types/index.js';`
], authLines, 'export { auth, SESSION_KEY, BRUTE_KEY };');

// 6. Modules (Renderers)
let renderLines = extractLines('6. ALL 16 MODULE', '7. MAIN APP', 2);
let renderBlocks = {};
let currentFunc = null;
let sharedFuncs = [];

const ALL_EXPORTS_FROM_UTILS = utilsExports.join(', ');

for (let i = 0; i < renderLines.length; i++) {
    let line = renderLines[i];
    let match = line.match(/^ {2,4}function (render[A-Za-z0-9_]+|bind[A-Za-z0-9_]+|init[A-Za-z0-9_]+|generate[A-Za-z0-9_]+|handle[A-Za-z0-9_]+)\(/);
    
    if (match && !line.includes('//')) {
        let fnName = match[1];
        
        if (fnName.startsWith('render') && !fnName.includes('Pagination')) {
           currentFunc = fnName.replace('render', '');
           currentFunc = currentFunc.charAt(0).toLowerCase() + currentFunc.slice(1);
           if (!renderBlocks[currentFunc]) renderBlocks[currentFunc] = [];
        } else if (!currentFunc) {
           currentFunc = "shared";
           if (!renderBlocks[currentFunc]) renderBlocks[currentFunc] = [];
           sharedFuncs.push(fnName);
        }
    }
    
    if (currentFunc) {
        renderBlocks[currentFunc].push(line);
    }
}

let appImports = [];
for (let mod in renderBlocks) {
    if(mod === 'shared') {
       writeModule('utils', `shared_render.js`, [
           `import { ${ALL_EXPORTS_FROM_UTILS} } from './helpers.js';`,
           `import { db } from '../services/db.js';`
       ], renderBlocks[mod], `export { ${sharedFuncs.join(', ')} };`);
       continue;
    }
    
    let fnName = `render${mod.charAt(0).toUpperCase() + mod.slice(1)}`;
    let code = renderBlocks[mod];
    
    let imports = [
        `import { db } from '../services/db.js';`,
        `import { auth } from '../services/auth.js';`,
        `import { ${ALL_EXPORTS_FROM_UTILS} } from '../utils/helpers.js';`,
        `import { ROLE_LABELS } from '../types/index.js';`
    ];
    
    if (code.some(l => l.includes('renderPaginationControls('))) {
       imports.push(`import { renderPaginationControls } from '../utils/shared_render.js';`);
    }

    writeModule('modules', `${mod}.js`, imports, code, `export { ${fnName} };`);
    appImports.push(`import { ${fnName} } from './src/modules/${mod}.js';`);
}

// 7. App Router
let appLines = extractLines('7. MAIN APP', '})();', 2);
appLines = appLines.filter(l => !l.includes('})();'));

writeModule('', 'app.js', [
    `import { auth } from './src/services/auth.js';`,
    `import { db } from './src/services/db.js';`,
    `import { ROLE_LABELS } from './src/types/index.js';`,
    `import { openModal, closeModal, escapeHTML, showToast } from './src/utils/helpers.js';`,
    ...appImports
], appLines, 'window.eduFlowApp = new EduFlowApp();\nexport default EduFlowApp;');

console.log("Refactoring complete.");
