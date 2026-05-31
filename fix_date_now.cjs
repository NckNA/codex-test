const fs = require('fs');
let content = fs.readFileSync('src/components/schedule/AppointmentModal.tsx', 'utf8');
content = content.replace(/id: formData\.id \|\| \`a\$\{Date\.now\(\)\}\`,/g, "id: formData.id || `a${new Date().getTime()}`,");
fs.writeFileSync('src/components/schedule/AppointmentModal.tsx', content, 'utf8');
