// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduleProvider } from './ScheduleProvider';
import { useScheduleContext } from '../hooks/useScheduleContext';

const tenantState = vi.hoisted(() => ({
  activeTenant: {
    tenantId: 'tenant-a',
    tenantName: 'Almaty Clinic',
    timezone: 'Asia/Almaty',
    role: 'clinic_admin',
  } as {
    tenantId: string;
    tenantName: string;
    timezone: string;
    role: string;
  } | null,
}));

vi.mock('../contexts/TenantContext', () => ({
  LEGACY_TENANT_TIMEZONE: 'Asia/Almaty',
  useTenant: () => tenantState,
}));

const Probe = () => {
  const schedule = useScheduleContext();
  return (
    <div>
      <div data-testid="selected-date">{schedule.selectedDate}</div>
      <button type="button" data-testid="set-custom-date" onClick={() => schedule.setSelectedDate('2030-01-15')}>
        Set custom date
      </button>
    </div>
  );
};

const renderProvider = async () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  const render = async () => {
    await act(async () => {
      root.render(
        <ScheduleProvider>
          <Probe />
        </ScheduleProvider>,
      );
    });
  };
  await render();
  return { container, root, render };
};

const selectedDate = (container: HTMLElement) => (
  container.querySelector('[data-testid="selected-date"]')?.textContent
);

describe('ScheduleProvider tenant date context', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-11T21:30:00.000Z'));
    tenantState.activeTenant = {
      tenantId: 'tenant-a',
      tenantName: 'Almaty Clinic',
      timezone: 'Asia/Almaty',
      role: 'clinic_admin',
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('derives today from the tenant timezone rather than browser or UTC day', async () => {
    const view = await renderProvider();
    expect(selectedDate(view.container)).toBe('2026-07-12');
    await act(async () => view.root.unmount());
  });

  it('clears the old tenant date selection when tenant and timezone change', async () => {
    const view = await renderProvider();
    await act(async () => {
      (view.container.querySelector('[data-testid="set-custom-date"]') as HTMLButtonElement).click();
    });
    expect(selectedDate(view.container)).toBe('2030-01-15');

    tenantState.activeTenant = {
      tenantId: 'tenant-b',
      tenantName: 'Berlin Clinic',
      timezone: 'Europe/Berlin',
      role: 'doctor',
    };
    await view.render();

    expect(selectedDate(view.container)).toBe('2026-07-11');
    expect(view.container.textContent).not.toContain('2030-01-15');
    await act(async () => view.root.unmount());
  });
});