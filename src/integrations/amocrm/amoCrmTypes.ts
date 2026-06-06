export interface AmoCrmContactDraft {
  name: string;
  phone?: string;
  email?: string;
}

export interface AmoCrmLeadDraft {
  name: string;
  price?: number;
  status?: string;
  source?: string;
}

export interface AmoCrmSyncPreview {
  contact?: AmoCrmContactDraft;
  lead?: AmoCrmLeadDraft;
  warnings: string[];
}
