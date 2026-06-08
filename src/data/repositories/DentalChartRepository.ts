import { storage } from '../../utils/storage';
import type { DentalChart } from '../../types';

export interface DentalChartRepository {
  getDentalChart(patientId: string): Promise<DentalChart>;
  saveDentalChart(patientId: string, chart: DentalChart): Promise<void>;
}

export const LocalStorageDentalChartRepository: DentalChartRepository = {
  async getDentalChart(patientId: string): Promise<DentalChart> {
    return storage.getDentalChart(patientId);
  },

  async saveDentalChart(patientId: string, chart: DentalChart): Promise<void> {
    storage.saveDentalChart(patientId, chart);
  },
};
