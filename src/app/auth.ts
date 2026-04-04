import { createHmac, randomBytes } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

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
  if (!base || !signature || sign(base) !== signature) {
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
    })
  );
}

function appendCookie(res: VercelResponse, cookie: string) {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", cookie);
    return;
  }
  const list = Array.isArray(existing) ? existing : [String(existing)];
  res.setHeader("Set-Cookie", [...list, cookie]);
}

export function getSessionActor(req: VercelRequest): { login: string } | undefined {
  const cookies = parseCookies(req.headers.cookie);
  return decodePayload<{ login: string }>(cookies[SESSION_COOKIE]);
}

export function setSessionActor(res: VercelResponse, login: string) {
  const value = encodePayload({ login });
  appendCookie(res, `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
}

export function clearSessionActor(res: VercelResponse) {
  appendCookie(res, `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export function buildOAuthState(sessionId: string): string {
  return encodePayload({ sessionId, nonce: randomBytes(8).toString("hex") });
}

export function readOAuthState(value: string | undefined): { sessionId: string; nonce: string } | undefined {
  return decodePayload<{ sessionId: string; nonce: string }>(value);
}

export function githubAuthorizeUrl(sessionId: string): string {
  const clientId = requiredEnv("GITHUB_CLIENT_ID");
  const baseUrl = requiredEnv("APP_BASE_URL").replace(/\/$/, "");
  const state = buildOAuthState(sessionId);
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${baseUrl}/auth/callback`);
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForLogin(code: string): Promise<string> {
  const clientId = requiredEnv("GITHUB_CLIENT_ID");
  const clientSecret = requiredEnv("GITHUB_CLIENT_SECRET");

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json"
    },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
  });
  const tokenJson = (await tokenResponse.json()) as { access_token?: string; error?: string };
  if (!tokenJson.access_token) {
    throw new Error(`OAuth token exchange failed: ${tokenJson.error ?? tokenResponse.status}`);
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      authorization: `Bearer ${tokenJson.access_token}`,
      accept: "application/vnd.github+json",
      "user-agent": "slopblock"
    }
  });
  const userJson = (await userResponse.json()) as { login?: string };
  if (!userJson.login) {
    throw new Error("Failed to load GitHub user after OAuth login.");
  }

  return userJson.login;
}
