import {
  type CommunicationTemplateContent,
  type CommunicationTemplateVariable,
  CommunicationTemplateValidationError,
  parseCommunicationTemplateVariables,
  validateCommunicationTemplateContent,
} from './CommunicationTemplate';

export interface CommunicationTemplateRenderResult {
  subject?: string;
  body: string;
  renderedCharacterCount: number;
  renderedFingerprint: string;
  variableKeys: CommunicationTemplateVariable[];
  warnings: string[];
}

const encoder = new TextEncoder();

export async function sha256Hex(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API is required for deterministic template fingerprints.');
  }
  const digest = await subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, '0')).join('');
}

export async function fingerprintCommunicationTemplateContent(
  content: CommunicationTemplateContent,
): Promise<string> {
  const validation = validateCommunicationTemplateContent(content);
  return sha256Hex(JSON.stringify({
    channel: content.channel,
    subject: content.subject?.trim() || null,
    body: content.body,
    variableKeys: validation.variableKeys,
  }));
}

export async function renderCommunicationTemplate(
  content: CommunicationTemplateContent,
  variables: Record<string, string>,
): Promise<CommunicationTemplateRenderResult> {
  const validation = validateCommunicationTemplateContent(content);
  const required = validation.variableKeys;
  const provided = Object.keys(variables).sort();

  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(variables, key) || !String(variables[key] ?? '').trim()) {
      throw new CommunicationTemplateValidationError(
        'invalid_content',
        'Для формирования сообщения не хватает обязательных данных.',
      );
    }
  }
  const extra = provided.filter((key) => !required.includes(key as CommunicationTemplateVariable));
  if (extra.length > 0) {
    throw new CommunicationTemplateValidationError(
      'unknown_variable',
      'Переданы лишние или неизвестные переменные шаблона.',
    );
  }

  const replace = (input: string): string => input.replace(
    /\{\{([a-z][a-z0-9_]*)\}\}/g,
    (_placeholder, key: string) => String(variables[key] ?? ''),
  );
  const subject = content.subject?.trim() ? replace(content.subject.trim()) : undefined;
  const body = replace(content.body);
  parseCommunicationTemplateVariables(subject, body);
  const warnings = [...validation.warnings];
  if (content.channel === 'sms' && body.length > 160 && !warnings.includes('sms_practical_single_message_length')) {
    warnings.push('sms_practical_single_message_length');
  }
  const renderedFingerprint = await sha256Hex(JSON.stringify({
    channel: content.channel,
    subject: subject ?? null,
    body,
    variableKeys: required,
  }));

  return {
    subject,
    body,
    renderedCharacterCount: body.length + (subject?.length ?? 0),
    renderedFingerprint,
    variableKeys: required,
    warnings,
  };
}
