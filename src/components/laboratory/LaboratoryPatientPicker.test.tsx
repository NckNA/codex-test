// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LaboratoryPatientPicker } from './LaboratoryPatientPicker';
import { useLaboratoryPatientLookup, type UseLaboratoryPatientLookupResult } from '../../data/hooks/useLaboratoryPatientLookup';

vi.mock('../../data/hooks/useLaboratoryPatientLookup', () => ({ useLaboratoryPatientLookup: vi.fn() }));
const mockedLookup = vi.mocked(useLaboratoryPatientLookup);

function lookupResult(overrides: Partial<UseLaboratoryPatientLookupResult> = {}): UseLaboratoryPatientLookupResult {
  return {
    ready: true,
    loading: false,
    results: [],
    error: null,
    query: '',
    search: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
    ...overrides,
  };
}

async function fillInput(input: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('LaboratoryPatientPicker', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onSelect = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockedLookup.mockReturnValue(lookupResult());
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render() {
    await act(async () => root.render(<LaboratoryPatientPicker onClose={onClose} onSelect={onSelect} />));
  }

  it('does not search or preload patients before two typed characters', async () => {
    const search = vi.fn().mockResolvedValue(undefined);
    mockedLookup.mockReturnValue(lookupResult({ search }));
    await render();

    const input = container.querySelector('[data-testid="laboratory-patient-search-input"]') as HTMLInputElement;
    const submit = container.querySelector('[data-testid="laboratory-patient-search-submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(container.querySelector('[data-testid="laboratory-patient-search-results"]')).toBeNull();

    await fillInput(input, 'А');
    expect(submit.disabled).toBe(true);
    expect(search).not.toHaveBeenCalled();
  });

  it('submits a bounded lookup only after explicit search', async () => {
    const search = vi.fn().mockResolvedValue(undefined);
    mockedLookup.mockReturnValue(lookupResult({ search }));
    await render();

    const input = container.querySelector('[data-testid="laboratory-patient-search-input"]') as HTMLInputElement;
    await fillInput(input, 'Иван');
    await act(async () => (container.querySelector('[data-testid="laboratory-patient-search-submit"]') as HTMLButtonElement).click());
    expect(search).toHaveBeenCalledWith('Иван');
  });

  it('renders only human lookup fields and returns the exact selected patient', async () => {
    const patient = { id: 'patient-1', fullName: 'Иван Иванов', phone: '+77001234567', status: 'active' };
    mockedLookup.mockReturnValue(lookupResult({ query: 'Иван', results: [patient] }));
    await render();

    expect(container.textContent).toContain('Иван Иванов');
    expect(container.textContent).toContain('+77001234567');
    expect(container.textContent).not.toContain('patient-1');
    await act(async () => (container.querySelector('[data-testid="laboratory-patient-result-patient-1"]') as HTMLButtonElement).click());
    expect(onSelect).toHaveBeenCalledWith(patient);
  });

  it('fails closed when lookup is unavailable and surfaces bounded errors', async () => {
    mockedLookup.mockReturnValue(lookupResult({ ready: false, error: new Error('Не удалось найти пациента.') }));
    await render();
    expect(container.querySelector('[data-testid="laboratory-patient-search-unavailable"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="laboratory-patient-search-error"]')?.textContent).toBe('Не удалось найти пациента.');
    expect((container.querySelector('[data-testid="laboratory-patient-search-submit"]') as HTMLButtonElement).disabled).toBe(true);
  });
});
