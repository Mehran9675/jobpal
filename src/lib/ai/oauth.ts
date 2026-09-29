import { PROVIDER_MAP } from './providers';
import type { OAuthTokens, ProviderConnection } from '@/types';

interface OAuthResult {
  ok: boolean;
  tokens?: OAuthTokens;
  message?: string;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(length = 64): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes).slice(0, length);
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Runs an OAuth 2.0 PKCE flow through `chrome.identity.launchWebAuthFlow`.
 * Providers must be configured with an authorize/token URL — either a built-in
 * provider (Gemini) or a custom provider the user configured.
 */
export async function startOAuthFlow(providerId: string, clientIdOverride?: string): Promise<OAuthResult> {
  const def = PROVIDER_MAP[providerId];
  if (!def?.oauth) return { ok: false, message: `${def?.name ?? providerId} does not support OAuth in JobPal. Use an API key instead.` };
  const clientId = clientIdOverride?.trim() || def.oauth.clientId;
  if (!clientId) {
    return { ok: false, message: `Add a public OAuth client ID for ${def.name} first (Google Cloud console → APIs & Services → Credentials).` };
  }
  if (!def.oauth.authorizeUrl || !def.oauth.tokenUrl) {
    return { ok: false, message: 'This custom provider needs both an authorize URL and a token URL.' };
  }
  if (!chrome.identity?.launchWebAuthFlow) {
    return { ok: false, message: 'This browser does not expose chrome.identity.launchWebAuthFlow.' };
  }

  const redirectUri = chrome.identity.getRedirectURL('oauth');
  const verifier = randomString(96);
  const challenge = await sha256(verifier);
  const state = randomString(24);

  const authUrl = new URL(def.oauth.authorizeUrl);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', def.oauth.scopes.join(' '));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  for (const [key, value] of Object.entries(def.oauth.extraAuthParams ?? {})) {
    authUrl.searchParams.set(key, value);
  }

  let redirectResponse: string | undefined;
  try {
    redirectResponse = await chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Sign-in window was closed.' };
  }
  if (!redirectResponse) return { ok: false, message: 'Authentication was cancelled.' };

  const parsed = new URL(redirectResponse);
  const code = parsed.searchParams.get('code');
  const returnedState = parsed.searchParams.get('state');
  const errorParam = parsed.searchParams.get('error');
  if (errorParam) return { ok: false, message: `Provider returned "${errorParam}".` };
  if (!code) return { ok: false, message: 'No authorization code was returned.' };
  if (returnedState && returnedState !== state) return { ok: false, message: 'OAuth state mismatch — the flow was tampered with.' };

  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });
    const response = await fetch(def.oauth.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = (await response.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string };
    if (!response.ok || !json.access_token) {
      return { ok: false, message: json.error_description ?? `Token exchange failed with HTTP ${response.status}.` };
    }
    return {
      ok: true,
      tokens: {
        accessToken: json.access_token,
        refreshToken: json.refresh_token,
        expiresAt: json.expires_in ? Date.now() + json.expires_in * 1000 : undefined,
        tokenType: 'Bearer',
      },
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Token exchange failed.' };
  }
}

export function connectionFromOAuth(providerId: string, tokens: OAuthTokens, model?: string): ProviderConnection {
  return { providerId, oauth: tokens, model, status: 'untested' };
}
