import type { CommunicationChannel, CommunicationLanguage, CommunicationPurpose } from './CommunicationCommand';

export const COMMUNICATION_TEMPLATE_PURPOSES = [
  'appointment_confirmation_request',
  'appointment_day_before_reminder',
  'appointment_same_day_reminder',
  'appointment_control_call_task',
] as const satisfies readonly CommunicationPurpose[];

export const COMMUNICATION_TEMPLATE_CHANNELS = ['sms', 'whatsapp', 'email'] as const satisfies readonly CommunicationChannel[];
export const COMMUNICATION_TEMPLATE_LANGUAGES = ['ru', 'kk', 'en'] as const satisfies readonly CommunicationLanguage[];

export const COMMUNICATION_TEMPLATE_VARIABLES = [
  'appointment_date',
  'appointment_time',
  'clinic_callback_phone',
  'clinic_name',
  'doctor_display_name',
  'patient_first_name',
] as const;

export type CommunicationTemplateVariable = typeof COMMUNICATION_TEMPLATE_VARIABLES[number];
export type CommunicationTemplateStatus = 'active' | 'inactive' | 'archived';
export type CommunicationTemplateVersionStatus = 'draft' | 'published' | 'superseded' | 'archived';

export interface CommunicationTemplateVersion {
  id: string;
  tenantId: string;
  templateId: string;
  versionNumber: number;
  status: CommunicationTemplateVersionStatus;
  subject?: string;
  body: string;
  variableKeys: CommunicationTemplateVariable[];
  contentFingerprint: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  publishedBy?: string;
  publishedAt?: string;
  archivedAt?: string;
  supersedesVersionId?: string;
}

export interface CommunicationTemplate {
  id: string;
  tenantId: string;
  purposeCode: CommunicationPurpose;
  channel: CommunicationChannel;
  language: CommunicationLanguage;
  displayName: string;
  status: CommunicationTemplateStatus;
  activeVersionId?: string;
  activeVersion?: CommunicationTemplateVersion;
  draftVersion?: CommunicationTemplateVersion;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface CommunicationTemplateContent {
  channel: CommunicationChannel;
  subject?: string | null;
  body: string;
}

export interface CommunicationTemplateValidation {
  variableKeys: CommunicationTemplateVariable[];
  warnings: string[];
}

export class CommunicationTemplateValidationError extends Error {
  readonly code:
    | 'invalid_placeholder'
    | 'forbidden_variable'
    | 'unknown_variable'
    | 'invalid_content'
    | 'missing_subject'
    | 'subject_forbidden'
    | 'length_exceeded';

  constructor(code: CommunicationTemplateValidationError['code'], message: string) {
    super(message);
    this.name = 'CommunicationTemplateValidationError';
    this.code = code;
  }
}

const ALLOWED_SET = new Set<string>(COMMUNICATION_TEMPLATE_VARIABLES);
const CLINICAL_VARIABLES = new Set([
  'diagnosis', 'complaint', 'finding', 'tooth', 'treatment', 'treatment_plan',
  'procedure', 'medical_result', 'clinical_result',
]);
const FINANCIAL_VARIABLES = new Set([
  'balance', 'debt', 'invoice', 'payment', 'discount', 'refund', 'write_off',
]);

const PLACEHOLDER = /\{\{([a-z][a-z0-9_]*)\}\}/g;
const HTML_LIKE_MARKUP = /<\/?[a-z][^>]*>/i;

const hasForbiddenControlCharacter = (value: string): boolean => Array.from(value).some((character) => {
  const code = character.charCodeAt(0);
  return code === 127 || (code < 32 && code !== 9 && code !== 10 && code !== 13);
});

export function parseCommunicationTemplateVariables(...parts: Array<string | null | undefined>): CommunicationTemplateVariable[] {
  const joined = parts.filter((part): part is string => typeof part === 'string').join('\n');
  const variables = new Set<string>();
  let match: RegExpExecArray | null;
  PLACEHOLDER.lastIndex = 0;
  while ((match = PLACEHOLDER.exec(joined)) !== null) variables.add(match[1]);

  const residual = joined.replace(PLACEHOLDER, '');
  PLACEHOLDER.lastIndex = 0;
  if (/[{}]/.test(residual)) {
    throw new CommunicationTemplateValidationError(
      'invalid_placeholder',
      'Шаблон содержит неизвестную или некорректную переменную.',
    );
  }

  for (const variable of variables) {
    if (CLINICAL_VARIABLES.has(variable) || FINANCIAL_VARIABLES.has(variable)) {
      throw new CommunicationTemplateValidationError(
        'forbidden_variable',
        'Шаблон содержит запрещённую клиническую или финансовую переменную.',
      );
    }
    if (!ALLOWED_SET.has(variable)) {
      throw new CommunicationTemplateValidationError(
        'unknown_variable',
        'Шаблон содержит неизвестную или некорректную переменную.',
      );
    }
  }

  return [...variables].sort() as CommunicationTemplateVariable[];
}

export function validateCommunicationTemplateContent(
  content: CommunicationTemplateContent,
): CommunicationTemplateValidation {
  const body = content.body ?? '';
  const subject = content.subject?.trim() || null;
  if (!body.trim()) {
    throw new CommunicationTemplateValidationError('invalid_content', 'Текст шаблона не может быть пустым.');
  }
  if (hasForbiddenControlCharacter(body) || (subject && hasForbiddenControlCharacter(subject))) {
    throw new CommunicationTemplateValidationError('invalid_content', 'Шаблон содержит недопустимые управляющие символы.');
  }
  if (HTML_LIKE_MARKUP.test(body) || (subject && HTML_LIKE_MARKUP.test(subject))) {
    throw new CommunicationTemplateValidationError('invalid_content', 'HTML и исполняемая разметка в шаблонах запрещены.');
  }

  if (content.channel === 'email') {
    if (!subject) {
      throw new CommunicationTemplateValidationError('missing_subject', 'Для email-шаблона требуется тема.');
    }
    if (subject.length > 200) {
      throw new CommunicationTemplateValidationError('length_exceeded', 'Тема email превышает допустимую длину.');
    }
  } else if (subject) {
    throw new CommunicationTemplateValidationError('subject_forbidden', 'Тема разрешена только для email-шаблона.');
  }

  const limit = content.channel === 'sms' ? 1000 : content.channel === 'whatsapp' ? 4000 : 10000;
  if (body.length > limit) {
    throw new CommunicationTemplateValidationError('length_exceeded', 'Текст шаблона превышает допустимую длину.');
  }

  const variableKeys = parseCommunicationTemplateVariables(subject, body);
  const warnings: string[] = [];
  if (content.channel === 'sms' && body.length > 160) warnings.push('sms_practical_single_message_length');
  return { variableKeys, warnings };
}

export function isCommunicationTemplateVariable(value: string): value is CommunicationTemplateVariable {
  return ALLOWED_SET.has(value);
}
