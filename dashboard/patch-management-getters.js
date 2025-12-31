const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'node_modules/@rancher/shell/plugins/dashboard-store/getters.js');

if (fs.existsSync(filePath)) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if already patched
  if (content.includes('if (type === "management.cattle.io.cluster"')) {
    console.log('Patch already applied');
    process.exit(0);
  }
  
  // Replace the schema check to handle Epinio cluster type
  // Match with flexible whitespace
  const pattern = /if \( !schema \) \{[\s\S]*?throw new Error\(`Unknown schema for type: \$\{ type \}`\);/;
  const replacement = `if ( !schema ) {
      if (type === "management.cattle.io.cluster" || type === "epinio.io.management.cluster") {
        url = "/epinio/rancher/v1/management.cattle.io.cluster";
        return url;
      }
      throw new Error(\`Unknown schema for type: \${ type }\`);`;
  
  if (pattern.test(content)) {
    content = content.replace(pattern, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Patched management store getters successfully');
    // Touch the file to update mtime
    const now = new Date();
    fs.utimesSync(filePath, now, now);
  } else {
    // Try a simpler pattern - just replace the throw line
    const simplePattern = /(\s+)(throw new Error\(`Unknown schema for type: \$\{ type \}`\);)/;
    if (simplePattern.test(content)) {
      content = content.replace(simplePattern, (match, indent, throwStmt) => {
        return `${indent}if (type === "management.cattle.io.cluster" || type === "epinio.io.management.cluster") {
${indent}  url = "/epinio/rancher/v1/management.cattle.io.cluster";
${indent}  return url;
${indent}}
${indent}${throwStmt}`;
      });
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Patched management store getters successfully (simple pattern)');
      const now = new Date();
      fs.utimesSync(filePath, now, now);
    } else {
      console.log('Pattern not found, patch may have already been applied or file structure changed');
      console.log('File content around schema check:');
      const lines = content.split('\n');
      const schemaLine = lines.findIndex(l => l.includes('if ( !schema )'));
      if (schemaLine >= 0) {
        console.log(lines.slice(Math.max(0, schemaLine - 2), schemaLine + 5).join('\n'));
      }
    }
  }
} else {
  console.log('Getters file not found:', filePath);
  process.exit(1);
}

