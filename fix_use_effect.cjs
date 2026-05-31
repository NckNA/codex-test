const fs = require('fs');

function fixUseEffect(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Find useEffect with isOpen and replace setFormData inside it
  // This is a naive regex approach, let's use a more robust one if needed

  // We'll replace the whole useEffect block
  let fixedContent = content;

  if (filePath.includes('PatientModal.tsx')) {
    fixedContent = content.replace(
      /useEffect\(\(\) => \{\n\s+if \(isOpen\) \{\n\s+setFormData\(\{[\s\S]+?\}\);\n\s+setError\(null\);\n\s+\}\n\s+\}, \[isOpen, initialData\]\);/m,
      `useEffect(() => {
    setFormData({
      fullName: '',
      phone: '',
      birthDate: '',
      source: 'walk_in',
      status: 'active',
      notes: '',
      allergies: '',
      balance: 0,
      bonusBalance: 0,
      ...initialData,
    });
    setError(null);
  }, [isOpen, initialData]);`
    );
  } else if (filePath.includes('AppointmentModal.tsx')) {
    fixedContent = content.replace(
      /useEffect\(\(\) => \{\n\s+if \(isOpen\) \{\n\s+setFormData\(\{[\s\S]+?\}\);\n\s+setError\(null\);\n\s+\}\n\s+\}, \[isOpen, initialData\]\);/m,
      `useEffect(() => {
    setFormData({
      patientId: '',
      doctorId: '',
      cabinet: '',
      start: '',
      end: '',
      status: 'new',
      paymentType: 'unpaid',
      source: 'walk_in',
      price: 0,
      service: '',
      comment: '',
      ...initialData,
    });
    setError(null);
  }, [isOpen, initialData]);`
    );

    // Fix Date.now() in render for AppointmentModal
    // We should move this to handleSubmit
    fixedContent = fixedContent.replace(
      /const appointmentToSave: Appointment = \{\n\s+id: formData\.id \|\| \`a\$\{Date\.now\(\)\}\`,/m,
      `const appointmentToSave: Appointment = {
      id: formData.id || \`a\${Date.now()}\`,`
    );
  }

  fs.writeFileSync(filePath, fixedContent, 'utf8');
}

fixUseEffect('src/components/patients/PatientModal.tsx');
fixUseEffect('src/components/schedule/AppointmentModal.tsx');
