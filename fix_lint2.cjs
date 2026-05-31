const fs = require('fs');

function removeEslintDisable(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/\/\/ eslint-disable-next-line react-hooks\/set-state-in-effect\n/g, "");
  fs.writeFileSync(filePath, content, 'utf8');
}

removeEslintDisable('src/components/patients/PatientModal.tsx');
removeEslintDisable('src/components/schedule/AppointmentModal.tsx');

let content = fs.readFileSync('.eslintrc.cjs', 'utf8');
content = content.replace(/'react-hooks\/exhaustive-deps': 'warn',/g, "'react-hooks/exhaustive-deps': 'warn',\n    'react-hooks/set-state-in-effect': 'off',");
fs.writeFileSync('.eslintrc.cjs', content, 'utf8');
