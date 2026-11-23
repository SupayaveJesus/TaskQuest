const assert = require("node:assert/strict");
const test = require("node:test");
const { createTestContext } = require("./helpers");
const { currentPeriodKey, opportunitiesThrough } = require("../domain/recurrence-calendar");

const withFixedNow = async (instant, work) => {
  const RealDate = Date;
  global.Date = class extends RealDate {
    constructor(...args) { return args.length ? new RealDate(...args) : new RealDate(instant); }
    static now() { return new RealDate(instant).getTime(); }
  };
  try { return await work(); } finally { global.Date = RealDate; }
};

test("IANA calendar derives local daily and Monday-week keys without UTC boundaries", () => {
  const instant = new Date("2026-03-02T02:30:00.000Z");
  assert.equal(currentPeriodKey("diaria", "America/Argentina/Buenos_Aires", instant), "2026-03-01");
  assert.equal(currentPeriodKey("semanal", "America/Argentina/Buenos_Aires", instant), "2026-02-23");
  assert.deepEqual(
    opportunitiesThrough({ recurrente: 1, frecuencia: "diaria", fecha: "2026-03-01", zona_horaria: "America/Argentina/Buenos_Aires" }, instant),
    ["2026-03-01"],
  );
});

test("recurrent activity creation persists a valid IANA timezone and rejects invalid input without mutation", async (t) => {
  const context = await createTestContext();
  t.after(() => context.close());
  await context.db.runAsync("INSERT INTO usuarios (id, nombre, correo, password) VALUES (1, 'Ada', 'ada@test.dev', 'hash')");
  const headers = { Authorization: `Bearer ${context.tokenFor(1)}`, "Content-Type": "application/json" };
  const invalid = await context.request("/api/actividades", { method: "POST", headers, body: JSON.stringify({ titulo: "Bad zone", recurrente: 1, frecuencia: "diaria", fecha: "2026-03-01", timezone: "Mars/Olympus" }) });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, "VALIDATION_ERROR");
  assert.equal((await context.db.getAsync("SELECT COUNT(*) AS count FROM actividades")).count, 0);
  const created = await context.request("/api/actividades", { method: "POST", headers, body: JSON.stringify({ titulo: "Local", recurrente: 1, frecuencia: "diaria", fecha: "2026-03-01", timezone: "America/Argentina/Buenos_Aires" }) });
  assert.equal(created.status, 201);
  assert.deepEqual(await context.db.getAsync("SELECT zona_horaria FROM actividades"), { zona_horaria: "America/Buenos_Aires" });
});

test("invalid activity update and assignment requests preserve existing rows", async (t) => {
  const context = await createTestContext();
  t.after(() => context.close());
  await context.db.runAsync("INSERT INTO usuarios (id, nombre, correo, password) VALUES (1, 'Ada', 'ada@mutation.test', 'hash')");
  await context.db.runAsync("INSERT INTO actividades (id, titulo, estado, recurrente, usuario_id) VALUES (1, 'Original', 'pendiente', 0, 1)");
  const headers = { Authorization: `Bearer ${context.tokenFor(1)}`, "Content-Type": "application/json" };
  const invalidUpdate = await context.request("/api/actividades/1", { method: "PUT", headers, body: JSON.stringify({ titulo: "", frecuencia: "diaria" }) });
  assert.equal(invalidUpdate.status, 400);
  assert.equal((await invalidUpdate.json()).error.code, "VALIDATION_ERROR");
  const invalidAssignment = await context.request("/api/actividades/1/asignacion", { method: "PATCH", headers, body: JSON.stringify({ asignadoUsuarioId: 1 }) });
  assert.equal(invalidAssignment.status, 409);
  assert.equal((await invalidAssignment.json()).error.code, "PERSONAL_ACTIVITY_CANNOT_BE_ASSIGNED");
  assert.deepEqual(await context.db.getAsync("SELECT titulo, asignado_usuario_id FROM actividades WHERE id = 1"), { titulo: "Original", asignado_usuario_id: null });
});

test("completing an owned pending activity awards 10 XP", async (t) => {
  const context = await createTestContext();
  t.after(() => context.close());

  await context.db.runAsync(
    "INSERT INTO usuarios (id, nombre, correo, password, puntos) VALUES (?, ?, ?, ?, ?)",
    [1, "Ada", "ada@example.test", "password-hash", 0],
  );

  await context.db.runAsync(
    "INSERT INTO actividades (id, titulo, estado, recurrente, usuario_id) VALUES (?, ?, ?, ?, ?)",
    [1, "Estudiar testing", "pendiente", 0, 1],
  );

  const response = await context.request("/api/actividades/1/cumplimientos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${context.tokenFor(1)}`,
      "Content-Type": "application/json",
    },
  });

  assert.equal(response.status, 201);

  const body = await response.json();
  assert.equal(body.mensaje, "Actividad completada correctamente");
  assert.equal(body.cumplimiento.actividadId, 1);
  assert.equal(body.cumplimiento.puntosGanados, 10);
  assert.equal(body.cumplimiento.puntosTotales, 10);

  assert.deepEqual(
    await context.db.getAsync(
      "SELECT estado FROM actividades WHERE id = ?",
      [1],
    ),
    { estado: "completada" },
  );

  assert.deepEqual(
    await context.db.getAsync(
      "SELECT actividad_id, actor_usuario_id, puntos FROM actividad_cumplimientos",
    ),
    { actividad_id: 1, actor_usuario_id: 1, puntos: 10 },
  );

  assert.deepEqual(
    await context.db.getAsync("SELECT puntos FROM usuarios WHERE id = ?", [1]),
    { puntos: 10 },
  );
});

test("retrying an owned completion is idempotent and awards XP only once", async (t) => {
  const context = await createTestContext();
  t.after(() => context.close());

  await context.db.runAsync(
    "INSERT INTO usuarios (id, nombre, correo, password, puntos) VALUES (?, ?, ?, ?, ?)",
    [1, "Ada", "ada@example.test", "password-hash", 0],
  );

  await context.db.runAsync(
    "INSERT INTO actividades (id, titulo, estado, recurrente, usuario_id) VALUES (?, ?, ?, ?, ?)",
    [1, "Estudiar idempotencia", "pendiente", 0, 1],
  );

  const request = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${context.tokenFor(1)}`,
    },
  };

  const firstResponse = await context.request(
    "/api/actividades/1/cumplimientos",
    request,
  );

  const retryResponse = await context.request(
    "/api/actividades/1/cumplimientos",
    request,
  );

  assert.equal(firstResponse.status, 201);
  assert.equal(retryResponse.status, 200);

  const retryBody = await retryResponse.json();
  assert.equal(retryBody.cumplimiento.actividadId, 1);
  assert.equal(retryBody.cumplimiento.puntosGanados, 10);
  assert.equal(retryBody.cumplimiento.puntosTotales, 10);

  assert.deepEqual(
    await context.db.getAsync(
      "SELECT COUNT(*) AS total, SUM(puntos) AS puntosOtorgados FROM actividad_cumplimientos WHERE actividad_id = ?",
      [1],
    ),
    { total: 1, puntosOtorgados: 10 },
  );

  assert.deepEqual(
    await context.db.getAsync("SELECT puntos FROM usuarios WHERE id = ?", [1]),
    { puntos: 10 },
  );
});

test("another user cannot complete an activity they do not own or receive XP", async (t) => {
  const context = await createTestContext();
  t.after(() => context.close());

  await context.db.runAsync(
    "INSERT INTO usuarios (id, nombre, correo, password, puntos) VALUES (?, ?, ?, ?, ?)",
    [1, "Ada", "ada@example.test", "password-hash", 0],
  );

  await context.db.runAsync(
    "INSERT INTO usuarios (id, nombre, correo, password, puntos) VALUES (?, ?, ?, ?, ?)",
    [2, "Grace", "grace@example.test", "password-hash", 0],
  );

  await context.db.runAsync(
    "INSERT INTO actividades (id, titulo, estado, recurrente, usuario_id) VALUES (?, ?, ?, ?, ?)",
    [1, "Actividad privada", "pendiente", 0, 1],
  );

  const response = await context.request("/api/actividades/1/cumplimientos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${context.tokenFor(2)}`,
    },
  });

  assert.equal(response.status, 404);

  assert.deepEqual(await response.json(), {
    error: {
      code: "ACTIVITY_NOT_FOUND",
      message: "Actividad no encontrada",
    },
  });

  assert.deepEqual(
    await context.db.getAsync(
      "SELECT estado FROM actividades WHERE id = ?",
      [1],
    ),
    { estado: "pendiente" },
  );

  assert.deepEqual(
    await context.db.getAsync(
      "SELECT COUNT(*) AS total FROM actividad_cumplimientos WHERE actividad_id = ?",
      [1],
    ),
    { total: 0 },
  );

  assert.deepEqual(
    await context.db.getAsync("SELECT puntos FROM usuarios WHERE id = ?", [2]),
    { puntos: 0 },
  );
});

test("an invalid client completion date returns 400 without mutations", async (t) => {
  const context = await createTestContext();
  t.after(() => context.close());

  await context.db.runAsync(
    "INSERT INTO usuarios (id, nombre, correo, password, puntos) VALUES (?, ?, ?, ?, ?)",
    [1, "Ada", "ada@example.test", "password-hash", 0],
  );

  await context.db.runAsync(
    "INSERT INTO actividades (id, titulo, estado, recurrente, usuario_id) VALUES (?, ?, ?, ?, ?)",
    [1, "Actividad con fecha inválida", "pendiente", 0, 1],
  );

  const response = await context.request("/api/actividades/1/cumplimientos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${context.tokenFor(1)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fecha: "2026-02-30" }),
  });

  assert.equal(response.status, 400);

  assert.deepEqual(await response.json(), {
    error: {
      code: "VALIDATION_ERROR",
      message: "La fecha de cumplimiento debe ser una fecha válida en formato YYYY-MM-DD",
    },
  });

  assert.deepEqual(
    await context.db.getAsync(
      "SELECT estado FROM actividades WHERE id = ?",
      [1],
    ),
    { estado: "pendiente" },
  );

  assert.deepEqual(
    await context.db.getAsync(
      "SELECT COUNT(*) AS total FROM actividad_cumplimientos WHERE actividad_id = ?",
      [1],
    ),
    { total: 0 },
  );

  assert.deepEqual(
    await context.db.getAsync("SELECT puntos FROM usuarios WHERE id = ?", [1]),
    { puntos: 0 },
  );
});

test("IANA daily and Monday-week recurrent HTTP completions retry only the current occurrence and credit XP once", async (t) => {
  const context = await createTestContext();
  t.after(() => context.close());
  const instant = "2026-03-02T02:30:00.000Z";
  await context.db.runAsync("INSERT INTO usuarios (id, nombre, correo, password, puntos) VALUES (1, 'Ada', 'iana@test.dev', 'hash', 0)");
  await context.db.runAsync("INSERT INTO actividades (id, titulo, estado, recurrente, frecuencia, fecha, zona_horaria, usuario_id) VALUES (1, 'Daily', 'pendiente', 1, 'diaria', '2026-03-01', 'America/Buenos_Aires', 1), (2, 'Weekly', 'pendiente', 1, 'semanal', '2026-02-23', 'America/Buenos_Aires', 1)");
  const headers = { Authorization: `Bearer ${context.tokenFor(1)}` };

  await withFixedNow(instant, async () => {
    for (const [id, expectedKey] of [[1, "2026-03-01"], [2, "2026-02-23"]]) {
      const first = await context.request(`/api/actividades/${id}/cumplimientos`, { method: "POST", headers });
      const retry = await context.request(`/api/actividades/${id}/cumplimientos`, { method: "POST", headers });
      assert.equal(first.status, 201);
      assert.equal(retry.status, 200);
      assert.equal((await first.json()).cumplimiento.fecha, expectedKey);
    }
  });

  assert.deepEqual(await context.db.allAsync("SELECT actividad_id, fecha FROM actividad_cumplimientos ORDER BY actividad_id"), [{ actividad_id: 1, fecha: "2026-03-01" }, { actividad_id: 2, fecha: "2026-02-23" }]);
  assert.deepEqual(await context.db.allAsync("SELECT actividad_id, fecha FROM actividad_ocurrencias ORDER BY actividad_id"), [{ actividad_id: 1, fecha: "2026-03-01" }, { actividad_id: 2, fecha: "2026-02-23" }]);
  assert.deepEqual(await context.db.getAsync("SELECT puntos FROM usuarios WHERE id = 1"), { puntos: 20 });
});

test("rejected protected writes return stable 400/401/403/404/409 codes without database mutations", async (t) => {
  const context = await createTestContext();
  t.after(() => context.close());
  await context.db.runAsync("INSERT INTO usuarios (id, nombre, correo, password) VALUES (1, 'Owner', 'owner@matrix.test', 'hash'), (2, 'Member', 'member@matrix.test', 'hash')");
  await context.db.runAsync("INSERT INTO proyectos (id, nombre, creador_id) VALUES (1, 'Project', 1)");
  await context.db.runAsync("INSERT INTO proyecto_usuarios (proyecto_id, usuario_id) VALUES (1, 1), (1, 2)");
  await context.db.runAsync("INSERT INTO actividades (id, titulo, recurrente, usuario_id, proyecto_id) VALUES (1, 'Assigned later', 0, 1, 1)");
  const ownerHeaders = { Authorization: `Bearer ${context.tokenFor(1)}`, "Content-Type": "application/json" };
  const memberHeaders = { Authorization: `Bearer ${context.tokenFor(2)}`, "Content-Type": "application/json" };
  const snapshot = async () => ({
    activities: (await context.db.getAsync("SELECT COUNT(*) AS count FROM actividades")).count,
    memberships: (await context.db.getAsync("SELECT COUNT(*) AS count FROM proyecto_usuarios")).count,
    completions: (await context.db.getAsync("SELECT COUNT(*) AS count FROM actividad_cumplimientos")).count,
    assignment: await context.db.getAsync("SELECT asignado_usuario_id FROM actividades WHERE id = 1"),
  });
  const cases = [
    { name: "400 validation", status: 400, code: "VALIDATION_ERROR", request: () => context.request("/api/actividades", { method: "POST", headers: ownerHeaders, body: JSON.stringify({ titulo: "" }) }) },
    { name: "401 authentication", status: 401, code: "AUTH_REQUIRED", request: () => context.request("/api/actividades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titulo: "Denied" }) }) },
    { name: "403 assignment authorization", status: 403, code: "PROJECT_FORBIDDEN", request: () => context.request("/api/actividades/1/asignacion", { method: "PATCH", headers: memberHeaders, body: JSON.stringify({ asignadoUsuarioId: 2 }) }) },
    { name: "404 missing completion", status: 404, code: "ACTIVITY_NOT_FOUND", request: () => context.request("/api/actividades/999/cumplimientos", { method: "POST", headers: ownerHeaders }) },
    { name: "409 duplicate membership", status: 409, code: "PROJECT_MEMBER_ALREADY_EXISTS", request: () => context.request("/api/proyectos/1/miembros", { method: "POST", headers: ownerHeaders, body: JSON.stringify({ usuarioId: 2 }) }) },
  ];

  for (const scenario of cases) {
    const before = await snapshot();
    const response = await scenario.request();
    assert.equal(response.status, scenario.status, scenario.name);
    assert.equal((await response.json()).error.code, scenario.code, scenario.name);
    assert.deepEqual(await snapshot(), before, scenario.name);
  }
});
