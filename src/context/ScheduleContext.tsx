import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

type ViewMode = 'day' | 'week' | 'month';

interface ScheduleContextType {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  doctorFilter: string | null;
  setDoctorFilter: (doctorId: string | null) => void;
  statusFilter: string | null;
  setStatusFilter: (status: string | null) => void;
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [doctorFilter, setDoctorFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

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
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
}

export function useScheduleContext() {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error('useScheduleContext must be used within a ScheduleProvider');
  }
  return context;
}
