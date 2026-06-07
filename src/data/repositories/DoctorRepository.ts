import type { Doctor } from '../../types';
import { storage } from '../../utils/storage';

export interface IDoctorRepository {
  listDoctors(): Promise<Doctor[]>;
  listActiveDoctors(): Promise<Doctor[]>;
}

export const LocalStorageDoctorRepository: IDoctorRepository = {
  listDoctors: async (): Promise<Doctor[]> => {
    return Promise.resolve(storage.getDoctors());
  },
  
  listActiveDoctors: async (): Promise<Doctor[]> => {
    const allDoctors = storage.getDoctors();
    return Promise.resolve(allDoctors.filter(d => d.active));
  }
};
