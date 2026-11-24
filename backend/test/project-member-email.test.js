const assert = require("node:assert/strict");
const test = require("node:test");
const { createTestContext } = require("./helpers");

const auth = (context, id) => ({
  Authorization: `Bearer ${context.tokenFor(id)}`,
  "Content-Type": "application/json",
});

const seed = async (context) => {
  await context.db.runAsync(
    "INSERT INTO usuarios (id, nombre, correo, password) VALUES (1, 'Owner', 'owner@test.dev', 'hash'), (2, 'Member', 'member@test.dev', 'hash'), (3, 'Outsider', 'outsider@test.dev', 'hash')",
  );
  await context.db.runAsync("INSERT INTO proyectos (id, nombre, creador_id) VALUES (1, 'Project', 1)");
  await context.db.runAsync("INSERT INTO proyecto_usuarios (proyecto_id, usuario_id) VALUES (1, 1)");
};

test("only the creator can add a project member by email", async (t) => {
  const context = await createTestContext();
  t.after(() => context.close());
  await seed(context);

  const response = await context.request("/api/proyectos/1/miembros/por-correo", {
    method: "POST",
    headers: auth(context, 3),
    body: JSON.stringify({ correo: "member@test.dev" }),
  });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "PROJECT_FORBIDDEN");
  assert.equal((await context.db.getAsync("SELECT COUNT(*) AS count FROM proyecto_usuarios WHERE proyecto_id = 1", [])).count, 1);
});

test("email member add rejects invalid email addresses", async (t) => {
  const context = await createTestContext();
  t.after(() => context.close());
  await seed(context);

  const response = await context.request("/api/proyectos/1/miembros/por-correo", {
    method: "POST",
    headers: auth(context, 1),
    body: JSON.stringify({ correo: "not-an-email" }),
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "INVALID_MEMBER_EMAIL");
});

test("email member add reports an unknown registered email only to the creator", async (t) => {
  const context = await createTestContext();
  t.after(() => context.close());
  await seed(context);

  const response = await context.request("/api/proyectos/1/miembros/por-correo", {
    method: "POST",
    headers: auth(context, 1),
    body: JSON.stringify({ correo: "missing@test.dev" }),
  });

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "REGISTERED_EMAIL_NOT_FOUND");
  assert.equal((await context.db.getAsync("SELECT COUNT(*) AS count FROM proyecto_usuarios WHERE proyecto_id = 1", [])).count, 1);
});

test("email member add normalizes the email and returns the existing member shape", async (t) => {
  const context = await createTestContext();
  t.after(() => context.close());
  await seed(context);

  const response = await context.request("/api/proyectos/1/miembros/por-correo", {
    method: "POST",
    headers: auth(context, 1),
    body: JSON.stringify({ correo: " MEMBER@TEST.DEV " }),
  });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    miembro: { id: 2, nombre: "Member", correo: "member@test.dev", puntos: 0 },
  });
  assert.equal((await context.db.getAsync("SELECT COUNT(*) AS count FROM proyecto_usuarios WHERE proyecto_id = 1 AND usuario_id = 2", [])).count, 1);
});

test("email member add preserves duplicate member behavior", async (t) => {
  const context = await createTestContext();
  t.after(() => context.close());
  await seed(context);
  await context.db.runAsync("INSERT INTO proyecto_usuarios (proyecto_id, usuario_id) VALUES (1, 2)");

  const response = await context.request("/api/proyectos/1/miembros/por-correo", {
    method: "POST",
    headers: auth(context, 1),
    body: JSON.stringify({ correo: "member@test.dev" }),
  });

  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "PROJECT_MEMBER_ALREADY_EXISTS");
});

test("concurrent email member adds create one membership and report one conflict", async (t) => {
  const context = await createTestContext();
  t.after(() => context.close());
  await seed(context);

  const responses = await Promise.all([
    context.request("/api/proyectos/1/miembros/por-correo", {
      method: "POST",
      headers: auth(context, 1),
      body: JSON.stringify({ correo: "member@test.dev" }),
    }),
    context.request("/api/proyectos/1/miembros/por-correo", {
      method: "POST",
      headers: auth(context, 1),
      body: JSON.stringify({ correo: "member@test.dev" }),
    }),
  ]);

  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  const conflict = responses.find((response) => response.status === 409);
  assert.equal((await conflict.json()).error.code, "PROJECT_MEMBER_ALREADY_EXISTS");
  assert.equal((await context.db.getAsync("SELECT COUNT(*) AS count FROM proyecto_usuarios WHERE proyecto_id = 1 AND usuario_id = 2", [])).count, 1);
});
