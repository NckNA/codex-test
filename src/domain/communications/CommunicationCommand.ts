export type CommunicationPurpose =
  | 'appointment_confirmation_request'
  | 'appointment_day_before_reminder'
  | 'appointment_same_day_reminder'
  | 'appointment_control_call_task';

export type CommunicationChannel = 'sms' | 'whatsapp' | 'email';
export type CommunicationAdapterCode = 'noop' | 'mock';
export type CommunicationOperationState =
  | 'prepared'
  | 'simulation_running'
  | 'simulation_succeeded'
  | 'simulation_failed'
  | 'simulation_uncertain'
  | 'cancelled';

export type CommunicationAdapterResultCode =
  | 'accepted'
  | 'rejected'
  | 'temporary_failure'
  | 'permanent_failure'
  | 'timeout_before_acceptance'
  | 'timeout_after_acceptance'
  | 'unknown';

export type CommunicationSimulationScenario =
  | 'success'
  | 'rejected'
  | 'temporary_failure'
  | 'permanent_failure'
  | 'timeout_before_acceptance'
  | 'timeout_after_acceptance'
  | 'unknown';

export type CommunicationLanguage = 'ru' | 'kk' | 'en';

export const COMMUNICATION_VARIABLE_KEYS = [
  'patient_first_name',
  'clinic_name',
  'appointment_date',
  'appointment_time',
  'doctor_display_name',
  'clinic_callback_phone',
] as const;

export type CommunicationVariableKey = typeof COMMUNICATION_VARIABLE_KEYS[number];
export type CommunicationVariableMap = Partial<Record<CommunicationVariableKey, string>>;

export interface CommunicationCommand {
  tenantId: string;
  operationId: string;
  reminderJobId: string;
  appointmentId: string;
  patientId: string;
  contactId: string;
  purposeCode: CommunicationPurpose;
  channel: CommunicationChannel;
  language: CommunicationLanguage;
  maskedDestination: string;
  destinationFingerprint: string;
  operationKey: string;
  variables: CommunicationVariableMap;
  requestedAt: string;
}

const PURPOSES: Record<string, CommunicationPurpose | undefined> = {
  confirmation_request: 'appointment_confirmation_request',
  day_before_reminder: 'appointment_day_before_reminder',
  same_day_reminder: 'appointment_same_day_reminder',
  control_call_task: 'appointment_control_call_task',
};

export function deriveCommunicationPurpose(reminderType: string): CommunicationPurpose {
  const purpose = PURPOSES[reminderType];
  if (!purpose) {
    throw new Error('Unsupported reminder type for communication orchestration.');
  }
  return purpose;
}

export function validateCommunicationVariables(
  variables: Record<string, unknown>,
): asserts variables is CommunicationVariableMap {
  const allowed = new Set<string>(COMMUNICATION_VARIABLE_KEYS);
  for (const [key, value] of Object.entries(variables)) {
    if (!allowed.has(key) || typeof value !== 'string') {
      throw new Error(`Unsupported communication variable: ${key}`);
    }
  }
}

export function maskCommunicationDestination(
  destination: string,
  channel: CommunicationChannel,
): string {
  if (channel === 'email') {
    const [local, domain] = destination.split('@');
    if (!local || !domain) return '***';
    return `${local.slice(0, 1)}***@${domain}`;
  }

  const hasPlus = destination.trim().startsWith('+');
  const digits = destination.replace(/\D/g, '');
  if (digits.length < 7) return '***';
  const prefixLength = Math.min(4, digits.length - 4);
  return `${hasPlus ? '+' : ''}${digits.slice(0, prefixLength)}***${digits.slice(-4)}`;
}

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
};

export function stableCommunicationJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

const fallbackDigest = (input: string): string => {
  const seeds = [
    0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35,
    0x27d4eb2f, 0x165667b1, 0xd3a2646c, 0xfd7046c5,
  ];
  return seeds.map((seed) => {
    let hash = seed >>> 0;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }).join('');
};

export async function fingerprintCommunicationValue(value: unknown): Promise<string> {
  const input = stableCommunicationJson(value);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return fallbackDigest(input);
  const bytes = new TextEncoder().encode(input);
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function fingerprintCommunicationCommand(
  command: CommunicationCommand,
): Promise<string> {
  validateCommunicationVariables(command.variables);
  return fingerprintCommunicationValue(command);
}

export function assertSafeCommunicationCommand(command: CommunicationCommand): void {
  validateCommunicationVariables(command.variables);
  if (!command.maskedDestination || command.maskedDestination.includes('@') && command.maskedDestination.split('@')[0].length > 4) {
    throw new Error('Communication destination must be masked.');
  }
  if (!/^[0-9a-f]{64}$/.test(command.destinationFingerprint)) {
    throw new Error('Communication destination fingerprint is invalid.');
  }
  if (!command.operationKey || command.operationKey.length < 8) {
    throw new Error('Communication operation key is invalid.');
  }
}
