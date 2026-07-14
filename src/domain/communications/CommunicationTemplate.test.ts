import { describe, expect, it } from 'vitest';
import {
  CommunicationTemplateValidationError,
  parseCommunicationTemplateVariables,
  validateCommunicationTemplateContent,
} from './CommunicationTemplate';

describe('CommunicationTemplate', () => {
  it('parses allowed placeholders in deterministic order', () => {
    expect(parseCommunicationTemplateVariables(
      'Здравствуйте, {{patient_first_name}}',
      '{{appointment_time}} {{clinic_name}} {{patient_first_name}}',
    )).toEqual(['appointment_time', 'clinic_name', 'patient_first_name']);
  });

  it.each(['unknown_value', 'raw_phone', 'document'])(
    'rejects unknown placeholder %s',
    (key) => expect(() => parseCommunicationTemplateVariables(`{{${key}}}`))
      .toThrow(CommunicationTemplateValidationError),
  );

  it.each(['diagnosis', 'complaint', 'finding', 'treatment_plan'])(
    'rejects clinical placeholder %s',
    (key) => expect(() => parseCommunicationTemplateVariables(`{{${key}}}`))
      .toThrow(/клиническую или финансовую/),
  );

  it.each(['balance', 'debt', 'invoice', 'payment'])(
    'rejects financial placeholder %s',
    (key) => expect(() => parseCommunicationTemplateVariables(`{{${key}}}`))
      .toThrow(/клиническую или финансовую/),
  );

  it.each(['{{patient_first_name}', '{patient_first_name}}', '{{ patient_first_name }}', '{{{{patient_first_name}}}}'])(
    'rejects malformed braces %s',
    (body) => {
      expect(() => parseCommunicationTemplateVariables(body)).toThrow(/некорректную переменную/);
    },
  );

  it('preserves RU and KK Unicode', () => {
    expect(validateCommunicationTemplateContent({
      channel: 'sms',
      body: 'Здравствуйте, {{patient_first_name}}. Қабылдау уақыты {{appointment_time}}.',
    }).variableKeys).toEqual(['appointment_time', 'patient_first_name']);
  });

  it('rejects subject for SMS and WhatsApp', () => {
    expect(() => validateCommunicationTemplateContent({ channel: 'sms', subject: 'Тема', body: 'Текст' }))
      .toThrow(/только для email/);
    expect(() => validateCommunicationTemplateContent({ channel: 'whatsapp', subject: 'Тема', body: 'Текст' }))
      .toThrow(/только для email/);
  });

  it('requires and accepts email subject', () => {
    expect(() => validateCommunicationTemplateContent({ channel: 'email', body: 'Текст' }))
      .toThrow(/требуется тема/);
    expect(validateCommunicationTemplateContent({ channel: 'email', subject: 'Напоминание', body: 'Текст' }))
      .toEqual({ variableKeys: [], warnings: [] });
  });

  it('enforces channel limits and plain text', () => {
    expect(() => validateCommunicationTemplateContent({ channel: 'sms', body: 'x'.repeat(1001) }))
      .toThrow(/превышает/);
    expect(() => validateCommunicationTemplateContent({ channel: 'email', subject: 'Тема', body: '<script>x</script>' }))
      .toThrow(/HTML/);
  });
});
