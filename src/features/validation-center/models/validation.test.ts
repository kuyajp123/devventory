import { describe, expect, it } from 'vitest';
import { validationRuleFormSchema } from './validation';

describe('validationRuleFormSchema', () => {
  const baseValid = {
    description: '',
    enabled: true,
    environmentIds: ['d63f9ad6-0817-4b8b-ad88-ec19881295b8'],
    ruleType: 'required',
    severity: 'error',
  };

  describe('keyName accepts normal env keys', () => {
    it.each([
      'DATABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_API_URL',
      'MY_SECRET',
      '_PRIVATE_KEY',
    ])('accepts %s', (keyName) => {
      const result = validationRuleFormSchema.safeParse({
        ...baseValid,
        keyName,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('keyName accepts custom keys', () => {
    it.each([
      'SERVICE-ACCOUNT.json',
      'service-account.json',
      'service-account.prod.json',
      'devventory-firebase-adminsdk.json',
      'google-services.json',
      'signing-key.p12',
    ])('accepts %s', (keyName) => {
      const result = validationRuleFormSchema.safeParse({
        ...baseValid,
        keyName,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('keyName rejects invalid input', () => {
    it.each([
      ['empty string', ''],
      ['whitespace only', '   '],
      ['path traversal', '../etc/passwd'],
      ['leading slash', '/absolute/path'],
      ['trailing slash', 'path/'],
      ['control character', 'KEY\x00NAME'],
      ['delete character', 'KEY\x7fNAME'],
    ])('rejects %s', (_label, keyName) => {
      const result = validationRuleFormSchema.safeParse({
        ...baseValid,
        keyName,
      });
      expect(result.success).toBe(false);
    });
  });
});
