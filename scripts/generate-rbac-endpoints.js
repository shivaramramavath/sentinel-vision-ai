const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') && !file.endsWith('.spec.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('apps/api/src');
const endpoints = [];

files.forEach((file) => {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes('@Controller')) return;

  const controllerMatch = content.match(/@Controller\(['"]?([^'"]*)['"]?\)/);
  const basePath = controllerMatch ? controllerMatch[1] : '';

  const lines = content.split('\n');
  let currentPermissions = [];
  let isStepUp = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const permMatch = line.match(/@RequirePermissions\(([^)]+)\)/);
    if (permMatch) {
      currentPermissions = permMatch[1]
        .split(',')
        .map((p) => p.trim().replace(/['"]/g, ''));
    }
    if (line.includes('@RequireStepUp()')) {
      isStepUp = true;
    }
    const methodMatch = line.match(
      /@(Get|Post|Put|Patch|Delete)\(['"]?([^'"]*)['"]?\)/,
    );
    if (methodMatch) {
      const verb = methodMatch[1].toUpperCase();
      const subPath = methodMatch[2];
      const fullPath = (
        '/api/v1/' +
        (basePath ? basePath + '/' : '') +
        subPath
      )
        .replace(/\/+/g, '/')
        .replace(/\/$/, '');
      endpoints.push({
        method: verb,
        path: fullPath,
        permissions: currentPermissions.length
          ? currentPermissions
          : ['authenticated / public'],
        stepUp: isStepUp,
        file: file.replace(/\\/g, '/'),
      });
      currentPermissions = [];
      isStepUp = false;
    }
  }
});

let md = '# Sentinel Vision AI — API Endpoint RBAC Audit\n\n';
md += '| HTTP Method | Endpoint | Required Permission(s) | Step-Up Required | Controller File |\n';
md += '|:---|:---|:---|:---:|:---|\n';

endpoints.sort((a, b) => a.path.localeCompare(b.path));

for (const ep of endpoints) {
  md +=
    '| ' +
    ep.method +
    ' | `' +
    ep.path +
    '` | ' +
    ep.permissions.map((p) => '`' + p + '`').join(', ') +
    ' | ' +
    (ep.stepUp ? 'Yes' : 'No') +
    ' | ' +
    ep.file +
    ' |\n';
}

fs.writeFileSync('docs/rbac-endpoints.md', md, 'utf8');
console.log(
  'Generated docs/rbac-endpoints.md with ' + endpoints.length + ' endpoints.',
);
