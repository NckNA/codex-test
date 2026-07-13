import { describe, expect, it } from 'vitest';
import {
  fingerprintCommunicationTemplateContent,
  renderCommunicationTemplate,
} from './CommunicationTemplateRenderer';

const content = {
  channel: 'sms' as const,
  body: 'Здравствуйте, {{patient_first_name}}. Запись в {{clinic_name}} на {{appointment_date}} в {{appointment_time}}.',
};

const variables = {
  patient_first_name: 'Айгүл',
  clinic_name: 'Алтынсака',
  appointment_date: '14.07.2026',
  appointment_time: '10:30',
};

describe('CommunicationTemplateRenderer', () => {
  it('renders deterministically and preserves Unicode', async () => {
    const first = await renderCommunicationTemplate(content, variables);
    const second = await renderCommunicationTemplate(content, variables);
    expect(first).toEqual(second);
    expect(first.body).toContain('Айгүл');
    expect(first.renderedFingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects missing variables', async () => {
    await expect(renderCommunicationTemplate(content, {
      patient_first_name: 'Айгүл',
      clinic_name: 'Алтынсака',
      appointment_date: '14.07.2026',
    })).rejects.toThrow(/не хватает обязательных данных/);
  });

  it('rejects extra variables', async () => {
    await expect(renderCommunicationTemplate(content, {
      ...variables,
      diagnosis: 'секрет',
    })).rejects.toThrow(/лишние или неизвестные/);
  });

  it('creates deterministic content fingerprint and changes it with body', async () => {
    const first = await fingerprintCommunicationTemplateContent(content);
    const second = await fingerprintCommunicationTemplateContent(content);
    const changed = await fingerprintCommunicationTemplateContent({ ...content, body: `${content.body}!` });
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(changed).not.toBe(first);
  });

  it('returns practical SMS warning without segmenting or sending', async () => {
    const result = await renderCommunicationTemplate({ channel: 'sms', body: 'x'.repeat(161) }, {});
    expect(result.warnings).toContain('sms_practical_single_message_length');
    expect(result.renderedCharacterCount).toBe(161);
  });
});
