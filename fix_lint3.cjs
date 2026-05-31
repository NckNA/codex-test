const fs = require('fs');

let content = fs.readFileSync('eslint.config.js', 'utf8');
content = content.replace(/rules: \{/g, "rules: {\n      'react-hooks/set-state-in-effect': 'off',");
fs.writeFileSync('eslint.config.js', content, 'utf8');
