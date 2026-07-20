/**
 * Auth service (P1 F1/G4/G5) — screens stay presentational; every Supabase
 * auth call routes through here. Native provider flows use signInWithIdToken
 * (PLAN.md §1: Apple mandatory alongside Google, Guideline 4.8).
 */
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export async function signUpWithEmail(args: {
  displayName: string;
  email: string;
  password: string;
}): Promise<{ needsEmailConfirm: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: args.email,
    password: args.password,
    options: { data: { display_name: args.displayName } },
  });
  if (error) throw error;
  if (!data.session) return { needsEmailConfirm: true }; // confirmations off in P1; future-proofing
  await supabase
    .from('profiles')
    .update({ tos_accepted_at: new Date().toISOString() })
    .eq('id', data.session.user.id);
  return { needsEmailConfirm: false };
}

export async function signInWithEmail(args: { email: string; password: string }) {
  const { error } = await supabase.auth.signInWithPassword(args);
  if (error) throw error;
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'runeverywhere://forgot-password',
  });
  if (error) throw error;
}

/** F4 calls this on mount when the deep link carries ?code=… */
export async function exchangeResetCode(code: string) {
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function appleSignInAvailable(): Promise<boolean> {
  return Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync());
}

/**
 * Returns the display name from the provider credential when this is the
 * first authorization (Apple only sends fullName once) — the caller writes it
 * to the profile if the trigger-created row has an empty display_name.
 */
export async function signInWithApple(): Promise<{ fullName: string | null } | null> {
  const rawNonce = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashed,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw e;
  }
  if (!credential.identityToken) throw new Error('Apple returned no identity token');
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;
  const parts = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean);
  return { fullName: parts.length ? parts.join(' ') : null };
}

let googleConfigured = false;

export async function signInWithGoogle(): Promise<{ fullName: string | null } | null> {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    throw new Error('Google sign-in not configured — set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
  }
  if (!googleConfigured) {
    GoogleSignin.configure({
      webClientId,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    });
    googleConfigured = true;
  }
  await GoogleSignin.hasPlayServices();
  let res;
  try {
    res = await GoogleSignin.signIn();
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return null;
    throw e;
  }
  if (res.type === 'cancelled') return null;
  const idToken = res.data.idToken;
  if (!idToken) {
    throw new Error('Google returned no idToken — check the webClientId configuration');
  }
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (error) throw error;
  return { fullName: res.data.user.name ?? null };
}

/** Shared post-OAuth hook: fill an empty display_name from the credential. */
export async function prefillDisplayName(fullName: string | null) {
  if (!fullName) return;
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return;
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', uid)
    .single();
  if (profile && profile.display_name === '') {
    await supabase.from('profiles').update({ display_name: fullName }).eq('id', uid);
  }
}
