const fs = require('fs');

// Fix PatientModal.tsx
let patientModal = fs.readFileSync('src/components/patients/PatientModal.tsx', 'utf8');
patientModal = patientModal.replace(
  /useEffect\(\(\) => \{\n\s+setFormData\(\{[\s\S]+?\}\);\n\s+setError\(null\);\n\s+\}, \[isOpen, initialData\]\);/m,
  `useEffect(() => {
    if (isOpen && initialData) {
      setFormData(prev => ({
        ...prev,
        fullName: initialData.fullName || '',
        phone: initialData.phone || '',
        birthDate: initialData.birthDate || '',
        source: initialData.source || 'walk_in',
        status: initialData.status || 'active',
        notes: initialData.notes || '',
        allergies: initialData.allergies || '',
        balance: initialData.balance || 0,
        bonusBalance: initialData.bonusBalance || 0,
        id: initialData.id,
      }));
      setError(null);
    } else if (isOpen) {
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
        });
        setError(null);
    }
  }, [isOpen, initialData]);`
);
fs.writeFileSync('src/components/patients/PatientModal.tsx', patientModal, 'utf8');

// Fix AppointmentModal.tsx
let apptModal = fs.readFileSync('src/components/schedule/AppointmentModal.tsx', 'utf8');
apptModal = apptModal.replace(
  /useEffect\(\(\) => \{\n\s+setFormData\(\{[\s\S]+?\}\);\n\s+setError\(null\);\n\s+\}, \[isOpen, initialData\]\);/m,
  `useEffect(() => {
    if (isOpen && initialData) {
      setFormData(prev => ({
        ...prev,
        ...initialData
      }));
      setError(null);
    } else if (isOpen) {
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
        });
        setError(null);
    }
  }, [isOpen, initialData]);`
);

// Fix Date.now() in AppointmentModal by passing a generated ID before render or just let it be handled differently
// Actually, it's inside `handleSubmit`, but eslint complains because it thinks it's inside render if it's not wrapped well.
// Wait, handleSubmit is an arrow function. Why is it complaining?
// Oh, maybe it's not inside handleSubmit?
