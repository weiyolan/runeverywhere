import { describe, expect, it } from 'vitest';

import { mapAuthError, passwordSchema, signInSchema, signUpSchema } from '@/lib/validation/auth';

describe('passwordSchema (mirrors hosted letters_digits policy)', () => {
  it.each([
    ['too short', 'ab1', false],
    ['digits only', '12345678', false],
    ['letters only', 'password', false],
    ['letters and digits', 'passw0rd', true],
    ['long mixed', 'correct horse 1', true],
  ])('%s → %s', (_label, value, ok) => {
    expect(passwordSchema.safeParse(value).success).toBe(ok);
  });
});

describe('signUpSchema', () => {
  const valid = { displayName: 'Maya', email: 'maya@example.com', password: 'passw0rd' };

  it('accepts a valid sign-up', () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['name empty', { displayName: '  ' }],
    ['name over 40', { displayName: 'x'.repeat(41) }],
    ['bad email', { email: 'not-an-email' }],
    ['weak password', { password: '12345678' }],
  ])('rejects %s', (_label, patch) => {
    expect(signUpSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});

describe('signInSchema', () => {
  it('requires email + non-empty password, no strength rule', () => {
    expect(signInSchema.safeParse({ email: 'a@b.co', password: 'legacy' }).success).toBe(true);
    expect(signInSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
    expect(signInSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
  });
});

describe('mapAuthError (supabase AuthApiError.code → user copy)', () => {
  it.each([
    ['invalid_credentials', 'Wrong email or password.'],
    ['user_already_exists', 'That email is already registered — log in instead.'],
    ['email_exists', 'That email is already registered — log in instead.'],
    ['weak_password', 'Use 8+ characters with letters and numbers.'],
    ['over_email_send_rate_limit', 'Too many emails sent — try again later.'],
    ['otp_expired', 'That link expired — request a new one.'],
  ])('%s', (code, copy) => {
    expect(mapAuthError({ code })).toBe(copy);
  });

  it('falls back for unknown codes and non-auth errors', () => {
    expect(mapAuthError({ code: 'something_novel' })).toBe('Something went wrong. Try again.');
    expect(mapAuthError(new Error('boom'))).toBe('Something went wrong. Try again.');
    expect(mapAuthError(undefined)).toBe('Something went wrong. Try again.');
  });
});
