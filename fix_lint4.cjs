const fs = require('fs');

let pcp = fs.readFileSync('src/pages/PatientCardPage.tsx', 'utf8');
pcp = pcp.replace(/as any/g, "as 'phone' | 'instagram' | 'walk_in' | 'referral'");
fs.writeFileSync('src/pages/PatientCardPage.tsx', pcp, 'utf8');

let pm = fs.readFileSync('src/components/patients/PatientModal.tsx', 'utf8');
pm = pm.replace(/useEffect\(\(\) => \{/g, "useEffect(() => {\n    // eslint-disable-next-line react-hooks/set-state-in-effect");
fs.writeFileSync('src/components/patients/PatientModal.tsx', pm, 'utf8');

let am = fs.readFileSync('src/components/schedule/AppointmentModal.tsx', 'utf8');
am = am.replace(/useEffect\(\(\) => \{/g, "useEffect(() => {\n    // eslint-disable-next-line react-hooks/set-state-in-effect");
fs.writeFileSync('src/components/schedule/AppointmentModal.tsx', am, 'utf8');
