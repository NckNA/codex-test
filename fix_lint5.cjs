const fs = require('fs');

let pcp = fs.readFileSync('src/pages/PatientCardPage.tsx', 'utf8');
pcp = pcp.replace(/const handleSave = \(updated: any\) => \{/g, "const handleSave = (updated: import('../../types').Patient) => {");
fs.writeFileSync('src/pages/PatientCardPage.tsx', pcp, 'utf8');

let pm = fs.readFileSync('src/components/patients/PatientModal.tsx', 'utf8');
pm = pm.replace(/\/\/ eslint-disable-next-line react-hooks\/set-state-in-effect\n/g, "");
pm = pm.replace(/setFormData\(prev => \(\{/g, "// eslint-disable-next-line react-hooks/set-state-in-effect\n      setFormData(prev => ({");
pm = pm.replace(/setFormData\(\{/g, "// eslint-disable-next-line react-hooks/set-state-in-effect\n        setFormData({");
fs.writeFileSync('src/components/patients/PatientModal.tsx', pm, 'utf8');

let am = fs.readFileSync('src/components/schedule/AppointmentModal.tsx', 'utf8');
am = am.replace(/\/\/ eslint-disable-next-line react-hooks\/set-state-in-effect\n/g, "");
am = am.replace(/setFormData\(prev => \(\{/g, "// eslint-disable-next-line react-hooks/set-state-in-effect\n      setFormData(prev => ({");
am = am.replace(/setFormData\(\{/g, "// eslint-disable-next-line react-hooks/set-state-in-effect\n        setFormData({");
fs.writeFileSync('src/components/schedule/AppointmentModal.tsx', am, 'utf8');

let eslintConfig = fs.readFileSync('eslint.config.js', 'utf8');
eslintConfig = eslintConfig.replace(/      'react-hooks\/set-state-in-effect': 'off',\n/g, "");
fs.writeFileSync('eslint.config.js', eslintConfig, 'utf8');
