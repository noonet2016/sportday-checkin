import crypto from "crypto";

const AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize";
const TOKEN_URL = "https://api.line.me/oauth2/v2.1/token";
const PROFILE_URL = "https://api.line.me/v2/profile";
const VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";

function channelId(): string {
  const id = process.env.LINE_CHANNEL_ID;
  if (!id) throw new Error("LINE_CHANNEL_ID is not set");
  return id;
}

function channelSecret(): string {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) throw new Error("LINE_CHANNEL_SECRET is not set");
  return secret;
}

function redirectUri(): string {
  const uri = process.env.LINE_REDIRECT_URI;
  if (!uri) throw new Error("LINE_REDIRECT_URI is not set");
  return uri;
}

/**
 * The app's public origin, derived from LINE_REDIRECT_URI rather than a request's
 * own URL. Behind Plesk/Passenger, req.url resolves to the internal bind address
 * (e.g. http://0.0.0.0:3000) instead of the real public hostname, which breaks any
 * redirect built from it.
 */
export function appOrigin(): string {
  return new URL(redirectUri()).origin;
}

export type OAuthMode = "login" | "bind";

/** Signed state payload so the callback can trust `mode` without a server-side store. */
export function signState(mode: OAuthMode, nonce: string): string {
  const payload = `${mode}:${nonce}`;
  const sig = crypto.createHmac("sha256", channelSecret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyState(state: string): { mode: OAuthMode; nonce: string } | null {
  const [value, sig] = state.split(".");
  if (!value || !sig) return null;
  const payload = Buffer.from(value, "base64url").toString();
  const expected = crypto.createHmac("sha256", channelSecret()).update(payload).digest("base64url");
  if (sig !== expected) return null;
  const [mode, nonce] = payload.split(":");
  if (mode !== "login" && mode !== "bind") return null;
  return { mode, nonce };
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: channelId(),
    redirect_uri: redirectUri(),
    state,
    scope: "profile openid",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Verify a LIFF-issued OpenID Connect ID token server-side against LINE, and return the
 * trusted identity. NEVER trust a client-sent userId — only the `sub` from a token that
 * LINE confirms. `client_id` MUST be the channel that issued the token; the LIFF app is
 * created under the SAME channel as LINE Login (LINE_CHANNEL_ID), so this reuses that id.
 */
export async function verifyLiffIdToken(idToken: string): Promise<LineProfile> {
  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId() }),
  });
  if (!res.ok) {
    throw new Error(`LINE id_token verify failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { sub?: string; name?: string; picture?: string };
  if (!data.sub) throw new Error("LINE id_token verify: missing sub");
  return { userId: data.sub, displayName: data.name ?? "", pictureUrl: data.picture };
}

export type LineProfile = { userId: string; displayName: string; pictureUrl?: string };

export async function exchangeCodeForProfile(code: string): Promise<LineProfile> {
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      client_id: channelId(),
      client_secret: channelSecret(),
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`LINE token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
  }
  const tokenData = (await tokenRes.json()) as { access_token: string };

  const profileRes = await fetch(PROFILE_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!profileRes.ok) {
    throw new Error(`LINE profile fetch failed: ${profileRes.status} ${await profileRes.text()}`);
  }
  return (await profileRes.json()) as LineProfile;
}
