import type { ToothPresenceStatus, VisualState } from '../types';

export function calculateVisualState(
  status: ToothPresenceStatus,
  diagnoses: string[] = [],
  plannedWorks: any[] = [],
  completedWorks: string[] = []
): VisualState {
  switch (status) {
    case 'missing': return 'missing';
    case 'implant': return 'implant';
    case 'root_remnant': return 'root';
    case 'primary': return 'healthy'; // Or a separate primary state if added later, but 'healthy' works for now as it's handled by ToothGrid logic. Wait, let's look at ToothGrid. It doesn't have a 'primary' state, it uses 'healthy' and adds a primary indicator icon.
    // wait, what about recently extracted? 
    case 'extracted_recent': return 'missing'; // ToothGrid handles it via crosshatch/dashed stroke.
    case 'impacted': return 'healthy'; // ToothGrid handles via dash array
    case 'unerupted': return 'healthy'; // ToothGrid handles via dash array
    case 'supernumerary': return 'healthy'; // ToothGrid handles via marker
    case 'natural': return 'healthy';
    default: return 'healthy';
  }
}
