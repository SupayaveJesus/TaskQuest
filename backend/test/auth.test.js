const assert = require("node:assert/strict");
const test = require("node:test");
const { createTestContext } = require("./helpers");

test("auth middleware requires a strict Bearer token and /me returns a password-free user", async (t) => {
  const context = await createTestContext();
  t.after(() => context.close());
  await context.db.runAsync(
    "INSERT INTO usuarios (nombre, correo, password, puntos) VALUES (?, ?, ?, ?)",
    ["Ada", "ada@example.test", "password-hash", 25],
  );

  const missing = await context.request("/api/auth/me");
  assert.equal(missing.status, 401);
  assert.deepEqual(await missing.json(), { error: { code: "AUTH_REQUIRED", message: "A Bearer token is required" } });

  const malformed = await context.request("/api/auth/me", { headers: { Authorization: "Bearer  token" } });
  assert.equal(malformed.status, 401);

  const response = await context.request("/api/auth/me", {
    headers: { Authorization: `Bearer ${context.tokenFor(1)}`, Origin: "http://allowed.test" },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.user, { id: 1, nombre: "Ada", correo: "ada@example.test", puntos: 25 });
  assert.equal("password" in body.user, false);
});

test("app returns a safe error payload for rejected CORS origins", async (t) => {
  const context = await createTestContext();
  t.after(() => context.close());
  const response = await context.request("/", { headers: { Origin: "https://untrusted.example" } });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: { code: "CORS_ORIGIN_DENIED", message: "Origin is not allowed" } });
});
