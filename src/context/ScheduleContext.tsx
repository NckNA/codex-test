import { createContext } from 'react';

export type ViewMode = 'day' | 'week' | 'month';

export interface ScheduleContextType {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  doctorFilter: string | null;
  setDoctorFilter: (doctorId: string | null) => void;
  statusFilter: string | null;
  setStatusFilter: (status: string | null) => void;
  sourceFilter: string | null;
  setSourceFilter: (source: string | null) => void;
}

export const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);
