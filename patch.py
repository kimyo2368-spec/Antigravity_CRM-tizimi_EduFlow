import os
import re

# 1. Update helpers.js
helpers_path = os.path.join('src', 'utils', 'helpers.js')
with open(helpers_path, 'r', encoding='utf-8') as f:
    helpers_content = f.read()

# Remove old export block
helpers_content = re.sub(r'export\s*\{[^}]+\};?', '', helpers_content).strip()

# Add missing functions if not present
if 'function delegateClicks' not in helpers_content:
    helpers_content += """

// Shared: delegate clicks on module-content
function delegateClicks(container, handlers) {
  if (container._delegateClickHandler) {
    container.removeEventListener('click', container._delegateClickHandler);
  }
  var handler = function(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;
    if (handlers[action]) {
      e.preventDefault();
      handlers[action](btn, e);
    }
  };
  container._delegateClickHandler = handler;
  container.addEventListener('click', handler);
}

// SEV-5-E FIX: Safe unique ID generator
function genId(prefix) {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}
"""

# Find all function names in helpers.js
function_names = re.findall(r'^  function ([a-zA-Z0-9_]+)\(', helpers_content, re.MULTILINE)
function_names += re.findall(r'^function ([a-zA-Z0-9_]+)\(', helpers_content, re.MULTILINE)
# Add variables like ITEMS_PER_PAGE if needed, but they are scoped. Let's just export functions.
# Ensure uniqueness
function_names = sorted(list(set(function_names)))

exports_block = "\nexport {\n  " + ",\n  ".join(function_names) + "\n};\n"
with open(helpers_path, 'w', encoding='utf-8') as f:
    f.write(helpers_content + "\n" + exports_block)

print(f"Updated {helpers_path} with {len(function_names)} exports.")

# 2. Fix db.js
db_path = os.path.join('src', 'services', 'db.js')
with open(db_path, 'r', encoding='utf-8') as f:
    db_content = f.read()

db_content = db_content.replace('generateId', 'genId')
with open(db_path, 'w', encoding='utf-8') as f:
    f.write(db_content)

# 3. Update all module imports
def update_imports(file_path, base_path_to_helpers):
    if not os.path.exists(file_path):
        return
        
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Find which helpers are actually used in this file
    used_helpers = []
    for func in function_names:
        if re.search(r'\b' + func + r'\b', content) and not re.search(r'function ' + func + r'\(', content):
            used_helpers.append(func)
            
    if not used_helpers:
        # If none used, just remove the helper import if it exists
        content = re.sub(r'import\s*\{[^}]+\}\s*from\s*[\'"].*helpers\.js[\'"];?\n?', '', content)
    else:
        # Replace existing helpers import or add one
        import_str = f"import {{ {', '.join(used_helpers)} }} from '{base_path_to_helpers}';"
        if 'helpers.js' in content:
            content = re.sub(r'import\s*\{[^}]+\}\s*from\s*[\'"].*helpers\.js[\'"];?', import_str, content)
        else:
            # prepend to file (after other imports)
            lines = content.split('\n')
            last_import = -1
            for i, line in enumerate(lines):
                if line.startswith('import '):
                    last_import = i
            lines.insert(last_import + 1, import_str)
            content = '\n'.join(lines)
            
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"Updated imports in {file_path}")

# Update db.js and auth.js
update_imports(os.path.join('src', 'services', 'db.js'), '../utils/helpers.js')
update_imports(os.path.join('src', 'services', 'auth.js'), '../utils/helpers.js')
update_imports('app.js', './src/utils/helpers.js')

# Update all modules
modules_dir = os.path.join('src', 'modules')
for filename in os.listdir(modules_dir):
    if filename.endswith('.js'):
        update_imports(os.path.join(modules_dir, filename), '../utils/helpers.js')
        
# Also update shared_render.js if it exists
update_imports(os.path.join('src', 'utils', 'shared_render.js'), './helpers.js')

print("Patch complete.")
