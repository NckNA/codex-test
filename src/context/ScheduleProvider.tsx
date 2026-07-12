import { useState } from 'react';
import type { ReactNode } from 'react';
import { ScheduleContext } from '../context/ScheduleContext';
import type { ViewMode } from '../context/ScheduleContext';
import { useTenant, LEGACY_TENANT_TIMEZONE } from '../contexts/TenantContext';
import { tenantNowDate } from '../domain/timezone';

interface DateSelection {
  contextKey: string;
  date: string;
}

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const { activeTenant } = useTenant();
  const timezone = activeTenant?.timezone ?? LEGACY_TENANT_TIMEZONE;
  const contextKey = `${activeTenant?.tenantId ?? 'no-tenant'}:${timezone}`;
  const [dateSelection, setDateSelection] = useState<DateSelection>(() => ({
    contextKey,
    date: tenantNowDate(timezone),
  }));
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [doctorFilter, setDoctorFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  const selectedDate = dateSelection.contextKey === contextKey
    ? dateSelection.date
    : tenantNowDate(timezone);
  const setSelectedDate = (date: string) => setDateSelection({ contextKey, date });

  return (
    <ScheduleContext.Provider
      value={{
        selectedDate,
        setSelectedDate,
        viewMode,
        setViewMode,
        doctorFilter,
        setDoctorFilter,
        statusFilter,
        setStatusFilter,
        sourceFilter,
        setSourceFilter,
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
}