import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { encrypt, decrypt } from "./crypto.js";

const SESSION_COOKIE = "slopblock_session";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function sessionSecret(): string {
  return process.env.SESSION_SECRET ?? requiredEnv("GITHUB_WEBHOOK_SECRET");
}

function sign(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("hex");
}

function encodePayload(payload: Record<string, string>): string {
  const json = JSON.stringify(payload);
  const base = Buffer.from(json, "utf8").toString("base64url");
  return `${base}.${sign(base)}`;
}

function decodePayload<T extends Record<string, string>>(value: string | undefined): T | undefined {
  if (!value) {
    return undefined;
  }

  const [base, signature] = value.split(".");
  if (!base || !signature) {
    return undefined;
  }

  const expected = sign(base);
  if (expected.length !== signature.length) {
    return undefined;
  }

  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return undefined;
  }

  return JSON.parse(Buffer.from(base, "base64url").toString("utf8")) as T;
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  return Object.fromEntries(
    header.split(";").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, decodeURIComponent(rest.join("="))];
    }),
  );
}

export function getSessionActor(req: {
  headers: { cookie?: string };
}): { login: string; token?: string } | undefined {
  const cookies = parseCookies(req.headers.cookie);
  const payload = decodePayload<{ login: string; encToken?: string }>(cookies[SESSION_COOKIE]);
  if (!payload) return undefined;
  let token: string | undefined;
  if (payload.encToken) {
    try {
      token = decrypt(payload.encToken);
    } catch {
      // If decryption fails (e.g. key rotation), continue without token
    }
  }
  return { login: payload.login, token };
}

export function buildSessionCookie(login: string, oauthToken?: string): string {
  const payload: Record<string, string> = { login };
  if (oauthToken) {
    payload.encToken = encrypt(oauthToken);
  }
  const value = encodePayload(payload);
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}

export function buildOAuthState(sessionId: string): string {
  return encodePayload({ sessionId, nonce: randomBytes(8).toString("hex") });
}

export function readOAuthState(
  value: string | undefined,
): { sessionId: string; nonce: string; returnTo?: string } | undefined {
  return decodePayload<{ sessionId: string; nonce: string; returnTo?: string }>(value);
}

export function githubAuthorizeUrl(sessionId: string, returnTo?: string): string {
  const clientId = requiredEnv("GITHUB_CLIENT_ID");
  const baseUrl = requiredEnv("APP_BASE_URL").replace(/\/$/, "");
  const statePayload: Record<string, string> = { sessionId, nonce: randomBytes(8).toString("hex") };
  if (returnTo) statePayload.returnTo = returnTo;
  const state = encodePayload(statePayload);
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${baseUrl}/auth/callback`);
  url.searchParams.set("scope", "read:user read:org");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForLogin(
  code: string,
): Promise<{ login: string; token: string }> {
  const clientId = requiredEnv("GITHUB_CLIENT_ID");
  const clientSecret = requiredEnv("GITHUB_CLIENT_SECRET");

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  const tokenJson = (await tokenResponse.json()) as { access_token?: string; error?: string };
  if (!tokenJson.access_token) {
    throw new Error(`OAuth token exchange failed: ${tokenJson.error ?? tokenResponse.status}`);
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      authorization: `Bearer ${tokenJson.access_token}`,
      accept: "application/vnd.github+json",
      "user-agent": "slopblock",
    },
  });
  const userJson = (await userResponse.json()) as { login?: string };
  if (!userJson.login) {
    throw new Error("Failed to load GitHub user after OAuth login.");
  }

  return { login: userJson.login, token: tokenJson.access_token };
}
