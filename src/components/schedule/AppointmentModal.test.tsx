/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AppointmentModal } from './AppointmentModal';
import { MemoryRouter } from 'react-router-dom';

describe('AppointmentModal', () => {
  const doctors = [{ id: 'd1', fullName: 'Dr. Test', specialization: 'Dentist', cabinet: 'Cab 1', active: true, color: 'blue' }];
  const patients = [{ id: 'p1', fullName: 'Patient Test', phone: '123', source: 'walk_in', status: 'active', createdAt: '' } as any];
  
  it('new appointment uses crypto.randomUUID()', async () => {
    const onSave = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    
    await act(async () => {
      root.render(
        <MemoryRouter>
          <AppointmentModal 
            isOpen={true} 
            onClose={() => {}} 
            onSave={onSave}
            initialData={{ doctorId: 'd1', start: '2023-01-01T10:00', end: '2023-01-01T11:00' }}
            appointments={[]}
            doctors={doctors}
            patients={patients}
          />
        </MemoryRouter>
      );
    });

    const form = container.querySelector('form') as HTMLFormElement;
    
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    
    expect(onSave).toHaveBeenCalled();
    const savedAppt = onSave.mock.calls[0][0];
    
    expect(savedAppt.id.length).toBe(36);
    expect(savedAppt.patientId).toBe('');
    expect(savedAppt.doctorId).toBe('d1');

    await act(async () => { root.unmount(); });
  });

  it('existing appointment preserves existing id', async () => {
    const onSave = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    
    await act(async () => {
      root.render(
        <MemoryRouter>
          <AppointmentModal 
            isOpen={true} 
            onClose={() => {}} 
            onSave={onSave}
            initialData={{ id: 'existing-id', doctorId: 'd1', start: '2023-01-01T10:00', end: '2023-01-01T11:00' }}
            appointments={[]}
            doctors={doctors}
            patients={patients}
          />
        </MemoryRouter>
      );
    });

    const form = container.querySelector('form') as HTMLFormElement;
    
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    
    expect(onSave).toHaveBeenCalled();
    const savedAppt = onSave.mock.calls[0][0];
    
    expect(savedAppt.id).toBe('existing-id');

    await act(async () => { root.unmount(); });
  });
});
