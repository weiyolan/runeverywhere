/**
 * Auth validation + error copy (P1 F1). The password rule mirrors the hosted
 * Auth policy (min 8, letters and digits) and local config.toml
 * `password_requirements = "letters_digits"` — all three layers must agree or
 * swapping `.env` backends changes sign-up behavior.
 */
import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Use 8+ characters with letters and numbers.')
  .regex(/\d/, 'Use 8+ characters with letters and numbers.')
  .regex(/[a-zA-Z]/, 'Use 8+ characters with letters and numbers.');

export const signUpSchema = z.object({
  displayName: z.string().trim().min(1, 'Enter your name').max(40, 'Max 40 characters'),
  email: z.string().trim().email('Enter a valid email'),
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});

const ERROR_COPY: Record<string, string> = {
  invalid_credentials: 'Wrong email or password.',
  user_already_exists: 'That email is already registered — log in instead.',
  email_exists: 'That email is already registered — log in instead.',
  weak_password: 'Use 8+ characters with letters and numbers.',
  over_email_send_rate_limit: 'Too many emails sent — try again later.',
  otp_expired: 'That link expired — request a new one.',
};

/** Map a supabase-js AuthApiError (or anything thrown) to inline user copy. */
export function mapAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : undefined;
  return (code && ERROR_COPY[code]) || 'Something went wrong. Try again.';
}
