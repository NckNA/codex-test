import { useState } from 'react';
import type { ReactNode } from 'react';
import { ScheduleContext } from '../context/ScheduleContext';
import type { ViewMode } from '../context/ScheduleContext';

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [doctorFilter, setDoctorFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

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
