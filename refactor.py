import os
import re

def extract_lines(lines, start_pattern, end_pattern=None, skip_lines=0):
    start_idx = -1
    for i, line in enumerate(lines):
        if start_pattern in line:
            start_idx = i
            break
            
    if start_idx == -1:
        return []
        
    start_idx += skip_lines
    end_idx = len(lines)
    
    if end_pattern:
        for i in range(start_idx, len(lines)):
            if end_pattern in lines[i]:
                end_idx = i
                break
                
    return [l.rstrip() for l in lines[start_idx:end_idx] if l.strip()]

def write_module(folder, filename, imports, content_lines, exports_str):
    folder_path = os.path.join(os.getcwd(), 'src', folder) if folder else os.getcwd()
    os.makedirs(folder_path, exist_ok=True)
    
    file_path = os.path.join(folder_path, filename)
    
    out = "\n".join(imports)
    if imports:
        out += "\n\n"
        
    out += "\n".join(content_lines) + "\n\n"
    out += exports_str
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(out)
    print(f"Created {file_path}")

with open('bundle.js', 'r', encoding='utf-8') as f:
    bundle_content = f.read()
    
lines = bundle_content.split('\n')

# 1 & 5. Utils
utils_lines1 = extract_lines(lines, '1. UTILS', '2. ROLES', 2)
utils_lines2 = extract_lines(lines, '5. MODAL HELPER', '6. ALL', 2)
utils_code = "\n".join(utils_lines1 + utils_lines2)

utils_exports = []
def replace_func(match):
    func_name = match.group(1)
    utils_exports.append(func_name)
    return f"function {func_name}("

utils_code = re.sub(r'function (escapeHTML|openModal|closeModal|showToast|formatMoney|formatDate|formatPhone|generateId|showConfirm|closeConfirm)\(', replace_func, utils_code)
utils_code_lines = utils_code.split('\n')
utils_exports_str = "export {\n  " + ",\n  ".join(utils_exports) + "\n};"
write_module('utils', 'helpers.js', [], utils_code_lines, utils_exports_str)

# 2. Roles
roles_lines = extract_lines(lines, '2. ROLES', '3. DATABASE', 2)
write_module('types', 'index.js', [], roles_lines, 'export { ROLE_LABELS };')

# 3. Database
db_lines = extract_lines(lines, '3. DATABASE', '4. AUTH', 2)
write_module('services', 'db.js', [
    "import { showToast, generateId } from '../utils/helpers.js';",
    "import { FIREBASE_CONFIG } from '../config.js';"
], db_lines, 'export { DatabaseService, db, STORAGE_KEY };')

# 4. Auth
auth_lines = extract_lines(lines, '4. AUTH', '5. MODAL', 2)
write_module('services', 'auth.js', [
    "import { db } from './db.js';",
    "import { showToast } from '../utils/helpers.js';",
    "import { ROLE_LABELS } from '../types/index.js';"
], auth_lines, 'export { auth, SESSION_KEY, BRUTE_KEY };')

# 6. Modules (Renderers)
render_lines = extract_lines(lines, '6. ALL 16 MODULE', '7. MAIN APP', 2)
render_blocks = {}
current_func = None
shared_funcs = []

for line in render_lines:
    match = re.match(r'^ {2,4}function (render[A-Za-z0-9_]+|bind[A-Za-z0-9_]+|init[A-Za-z0-9_]+|generate[A-Za-z0-9_]+|handle[A-Za-z0-9_]+)\(', line)
    
    if match and '//' not in line:
        fn_name = match.group(1)
        if fn_name.startswith('render') and 'Pagination' not in fn_name:
            current_func = fn_name.replace('render', '')
            current_func = current_func[0].lower() + current_func[1:]
            if current_func not in render_blocks:
                render_blocks[current_func] = []
        elif not current_func:
            current_func = "shared"
            if current_func not in render_blocks:
                render_blocks[current_func] = []
            shared_funcs.append(fn_name)
            
    if current_func:
        render_blocks[current_func].append(line)

app_imports = []
all_utils_exports = ", ".join(utils_exports)

for mod, code in render_blocks.items():
    if mod == 'shared':
        write_module('utils', 'shared_render.js', [
            f"import {{ {all_utils_exports} }} from './helpers.js';",
            "import { db } from '../services/db.js';"
        ], code, "export { " + ", ".join(shared_funcs) + " };")
        continue
        
    fn_name = f"render{mod[0].upper() + mod[1:]}"
    imports = [
        "import { db } from '../services/db.js';",
        "import { auth } from '../services/auth.js';",
        f"import {{ {all_utils_exports} }} from '../utils/helpers.js';",
        "import { ROLE_LABELS } from '../types/index.js';"
    ]
    
    if any('renderPaginationControls(' in l for l in code):
        imports.append("import { renderPaginationControls } from '../utils/shared_render.js';")
        
    write_module('modules', f"{mod}.js", imports, code, f"export {{ {fn_name} }};")
    app_imports.append(f"import {{ {fn_name} }} from './src/modules/{mod}.js';")

# 7. App Router
app_lines = extract_lines(lines, '7. MAIN APP', '})();', 2)
app_lines = [l for l in app_lines if '})();' not in l]

write_module('', 'app.js', [
    "import { auth } from './src/services/auth.js';",
    "import { db } from './src/services/db.js';",
    "import { ROLE_LABELS } from './src/types/index.js';",
    "import { openModal, closeModal, escapeHTML, showToast } from './src/utils/helpers.js';"
] + app_imports, app_lines, 'window.eduFlowApp = new EduFlowApp();\nexport default EduFlowApp;')

print("Refactoring complete.")
