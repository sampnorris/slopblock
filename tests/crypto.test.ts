import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { encrypt, decrypt } from "../src/lib/server/crypto.js";

// Set a valid 32-byte hex key for testing
const TEST_KEY = randomBytes(32).toString("hex");

test("encrypt and decrypt round-trip produces original plaintext", () => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
  const plaintext = "my-secret-api-key-1234";
  const encrypted = encrypt(plaintext);
  const decrypted = decrypt(encrypted);
  assert.equal(decrypted, plaintext);
});

test("encrypt produces different ciphertext each time (random IV)", () => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
  const plaintext = "same-input";
  const a = encrypt(plaintext);
  const b = encrypt(plaintext);
  assert.notEqual(a, b);
});

test("encrypted format is three dot-separated base64 segments", () => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
  const encrypted = encrypt("test");
  const parts = encrypted.split(".");
  assert.equal(parts.length, 3);
  for (const part of parts) {
    assert.doesNotThrow(() => Buffer.from(part, "base64"));
  }
});

test("decrypt throws on malformed input", () => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
  assert.throws(() => decrypt("not-valid-format"), /Invalid encrypted value format/);
});

test("decrypt throws on tampered ciphertext", () => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
  const encrypted = encrypt("secret");
  const parts = encrypted.split(".");
  // Tamper with the ciphertext portion
  parts[1] = Buffer.from("tampered-data").toString("base64");
  assert.throws(() => decrypt(parts.join(".")));
});

test("encrypt throws when ENCRYPTION_KEY is missing", () => {
  const saved = process.env.ENCRYPTION_KEY;
  delete process.env.ENCRYPTION_KEY;
  try {
    assert.throws(() => encrypt("test"), /Missing ENCRYPTION_KEY/);
  } finally {
    process.env.ENCRYPTION_KEY = saved;
  }
});

test("encrypt throws when ENCRYPTION_KEY has wrong length", () => {
  const saved = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = "aabbcc"; // too short
  try {
    assert.throws(() => encrypt("test"), /64-character hex string/);
  } finally {
    process.env.ENCRYPTION_KEY = saved;
  }
});

test("round-trip works with single character", () => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
  const encrypted = encrypt("x");
  assert.equal(decrypt(encrypted), "x");
});

test("round-trip works with unicode", () => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
  const plaintext = "héllo wörld 🔐";
  assert.equal(decrypt(encrypt(plaintext)), plaintext);
});
