import test from "node:test";
import assert from "node:assert/strict";
import {
  getSessionActor,
  buildSessionCookie,
  buildOAuthState,
  readOAuthState,
} from "../src/lib/server/auth.js";

// Auth functions need a signing secret. Use GITHUB_WEBHOOK_SECRET as fallback.
const TEST_SECRET = "test-webhook-secret-for-auth-tests";

test("buildSessionCookie and getSessionActor round-trip", () => {
  process.env.GITHUB_WEBHOOK_SECRET = TEST_SECRET;

  const cookie = buildSessionCookie("alice");
  // Extract just the cookie value (name=value; attributes...)
  const cookieValue = cookie.split(";")[0];

  const actor = getSessionActor({
    headers: { cookie: cookieValue },
  });

  assert.ok(actor);
  assert.equal(actor.login, "alice");
});

test("getSessionActor returns undefined for missing cookie", () => {
  process.env.GITHUB_WEBHOOK_SECRET = TEST_SECRET;

  const actor = getSessionActor({ headers: {} });
  assert.equal(actor, undefined);
});

test("getSessionActor returns undefined for tampered cookie", () => {
  process.env.GITHUB_WEBHOOK_SECRET = TEST_SECRET;

  const actor = getSessionActor({
    headers: { cookie: "slopblock_session=tampered.invalidsig" },
  });
  assert.equal(actor, undefined);
});

test("buildSessionCookie sets HttpOnly and Secure flags", () => {
  process.env.GITHUB_WEBHOOK_SECRET = TEST_SECRET;
  const cookie = buildSessionCookie("bob");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
});

test("buildOAuthState and readOAuthState round-trip", () => {
  process.env.GITHUB_WEBHOOK_SECRET = TEST_SECRET;

  const state = buildOAuthState("session-42");
  const parsed = readOAuthState(state);

  assert.ok(parsed);
  assert.equal(parsed.sessionId, "session-42");
  assert.ok(parsed.nonce.length > 0);
});

test("readOAuthState returns undefined for undefined input", () => {
  process.env.GITHUB_WEBHOOK_SECRET = TEST_SECRET;
  assert.equal(readOAuthState(undefined), undefined);
});

test("readOAuthState returns undefined for tampered state", () => {
  process.env.GITHUB_WEBHOOK_SECRET = TEST_SECRET;
  assert.equal(readOAuthState("garbage.badsig"), undefined);
});

test("session cookies signed with different secrets are rejected", () => {
  process.env.GITHUB_WEBHOOK_SECRET = TEST_SECRET;
  const cookie = buildSessionCookie("alice");
  const cookieValue = cookie.split(";")[0];

  // Switch to a different secret
  process.env.GITHUB_WEBHOOK_SECRET = "different-secret-entirely";
  const actor = getSessionActor({
    headers: { cookie: cookieValue },
  });
  assert.equal(actor, undefined);

  // Restore
  process.env.GITHUB_WEBHOOK_SECRET = TEST_SECRET;
});
