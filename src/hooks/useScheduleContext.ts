import { useContext } from 'react';
import { ScheduleContext } from '../context/ScheduleContext';

export function useScheduleContext() {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error('useScheduleContext must be used within a ScheduleProvider');
  }
  return context;
}
