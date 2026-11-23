const assert = require("node:assert/strict");
const test = require("node:test");
const { createTestContext } = require("./helpers");

const auth = (context, id) => ({ Authorization: `Bearer ${context.tokenFor(id)}`, "Content-Type": "application/json" });
const withFixedNow = async (instant, work) => {
  const RealDate = Date;
  global.Date = class extends RealDate {
    constructor(...args) { return args.length ? new RealDate(...args) : new RealDate(instant); }
    static now() { return new RealDate(instant).getTime(); }
  };
  try { return await work(); } finally { global.Date = RealDate; }
};
const seedUsers = async (context) => {
  await context.db.runAsync("INSERT INTO usuarios (id, nombre, correo, password) VALUES (1, 'Owner', 'owner@test.dev', 'hash'), (2, 'Member', 'member@test.dev', 'hash'), (3, 'Outsider', 'outsider@test.dev', 'hash')");
  await context.db.runAsync("INSERT INTO proyectos (id, nombre, creador_id) VALUES (1, 'Shared', 1)");
  await context.db.runAsync("INSERT INTO proyecto_usuarios (proyecto_id, usuario_id) VALUES (1, 1), (1, 2)");
};

test("only an owner can delete a project and owner deletion removes scoped data", async (t) => {
  const context = await createTestContext(); t.after(() => context.close()); await seedUsers(context);
  await context.db.runAsync("INSERT INTO actividades (id, titulo, recurrente, usuario_id, proyecto_id, asignado_usuario_id) VALUES (1, 'Scoped', 0, 1, 1, 2)");
  const denied = await context.request("/api/proyectos/1", { method: "DELETE", headers: auth(context, 2) });
  assert.equal(denied.status, 403);
  assert.equal((await context.db.getAsync("SELECT COUNT(*) AS count FROM proyectos", [])).count, 1);
  const deleted = await context.request("/api/proyectos/1", { method: "DELETE", headers: auth(context, 1) });
  assert.equal(deleted.status, 200);
  assert.equal((await context.db.getAsync("SELECT COUNT(*) AS count FROM actividades", [])).count, 0);
  assert.equal((await context.db.getAsync("SELECT COUNT(*) AS count FROM proyecto_usuarios", [])).count, 0);
});

test("member removal unassigns activities and revokes their project access", async (t) => {
  const context = await createTestContext(); t.after(() => context.close()); await seedUsers(context);
  await context.db.runAsync("INSERT INTO actividades (id, titulo, recurrente, usuario_id, proyecto_id, asignado_usuario_id) VALUES (1, 'Scoped', 0, 1, 1, 2)");
  const response = await context.request("/api/proyectos/1/miembros/2", { method: "DELETE", headers: auth(context, 1) });
  assert.equal(response.status, 200);
  assert.deepEqual(await context.db.getAsync("SELECT asignado_usuario_id FROM actividades WHERE id = 1"), { asignado_usuario_id: null });
  const activity = await context.request("/api/actividades/1", { headers: auth(context, 2) });
  assert.equal(activity.status, 404);
  const report = await context.request("/api/progreso/proyectos/1", { headers: auth(context, 2) });
  assert.equal(report.status, 403);
});

test("removed members have no inaccessible personal progress and a bounded rate", async (t) => {
  const context = await createTestContext(); t.after(() => context.close()); await seedUsers(context);
  await context.db.runAsync("INSERT INTO actividades (id, titulo, recurrente, usuario_id, proyecto_id, asignado_usuario_id) VALUES (1, 'Scoped', 0, 1, 1, 2)");
  assert.equal((await context.request("/api/proyectos/1/miembros/2", { method: "DELETE", headers: auth(context, 1) })).status, 200);
  const response = await context.request("/api/progreso/personal?asOf=2026-03-02T02:30:00.000Z", { headers: auth(context, 2) });
  assert.equal(response.status, 200);
  const progress = await response.json();
  assert.equal(progress.activities.some((activity) => activity.activityId === 1), false);
  assert.ok(progress.completed >= 0 && progress.completed <= progress.eligible);
  assert.ok(progress.rate >= 0 && progress.rate <= 1);
});

test("creator removal is rejected without membership mutation", async (t) => {
  const context = await createTestContext(); t.after(() => context.close()); await seedUsers(context);
  const response = await context.request("/api/proyectos/1/miembros/1", { method: "DELETE", headers: auth(context, 1) });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "PROJECT_CREATOR_MEMBERSHIP_REQUIRED");
  assert.equal((await context.db.getAsync("SELECT COUNT(*) AS count FROM proyecto_usuarios WHERE proyecto_id = 1 AND usuario_id = 1")).count, 1);
});

test("project deletion removes completion and occurrence records", async (t) => {
  const context = await createTestContext(); t.after(() => context.close()); await seedUsers(context);
  await context.db.runAsync("INSERT INTO actividades (id, titulo, estado, recurrente, frecuencia, fecha, zona_horaria, usuario_id, proyecto_id, asignado_usuario_id) VALUES (1, 'Scoped', 'pendiente', 1, 'diaria', '2026-03-01', 'UTC', 1, 1, 2)");
  await context.db.runAsync("INSERT INTO actividad_ocurrencias (actividad_id, fecha, estado) VALUES (1, '2026-03-01', 'completada')");
  await context.db.runAsync("INSERT INTO actividad_cumplimientos (actividad_id, actor_usuario_id, fecha, puntos) VALUES (1, 2, '2026-03-01', 10)");
  assert.equal((await context.request("/api/proyectos/1", { method: "DELETE", headers: auth(context, 1) })).status, 200);
  assert.equal((await context.db.getAsync("SELECT COUNT(*) AS count FROM actividad_cumplimientos")).count, 0);
  assert.equal((await context.db.getAsync("SELECT COUNT(*) AS count FROM actividad_ocurrencias")).count, 0);
  assert.equal((await context.request("/api/progreso/proyectos/1", { headers: auth(context, 2) })).status, 403);
});

test("IANA recurrence completion, personal progress, and authorized project report share canonical aggregates", async (t) => {
  const context = await createTestContext(); t.after(() => context.close()); await seedUsers(context);
  const instant = "2026-03-02T02:30:00.000Z";
  await context.db.runAsync("INSERT INTO actividades (id, titulo, estado, recurrente, frecuencia, fecha, zona_horaria, usuario_id, proyecto_id, asignado_usuario_id) VALUES (1, 'Daily', 'pendiente', 1, 'diaria', '2026-03-01', 'America/Buenos_Aires', 1, 1, 2), (2, 'Weekly', 'pendiente', 1, 'semanal', '2026-02-23', 'America/Buenos_Aires', 1, 1, 2)");
  await withFixedNow(instant, async () => {
    for (const id of [1, 2]) {
      assert.equal((await context.request(`/api/actividades/${id}/cumplimientos`, { method: "POST", headers: auth(context, 2) })).status, 201);
      assert.equal((await context.request(`/api/actividades/${id}/cumplimientos`, { method: "POST", headers: auth(context, 2) })).status, 200);
    }
  });
  const personal = await context.request(`/api/progreso/personal?asOf=${instant}`, { headers: auth(context, 2) });
  const report = await context.request(`/api/progreso/proyectos/1?asOf=${instant}`, { headers: auth(context, 2) });
  assert.equal(report.status, 200);
  const personalBody = await personal.json();
  const reportBody = await report.json();
  assert.deepEqual(
    { eligible: reportBody.eligible, completed: reportBody.completed, rate: reportBody.rate, asOf: reportBody.asOf },
    { eligible: personalBody.eligible, completed: personalBody.completed, rate: personalBody.rate, asOf: personalBody.asOf },
  );
  assert.deepEqual(
    reportBody.activities.map(({ activityId, eligible, completed, rate, recurrence }) => ({ activityId, eligible, completed, rate, recurrence })),
    [
      { activityId: 1, eligible: 1, completed: 1, rate: 1, recurrence: { frequency: "diaria", timezone: "America/Buenos_Aires" } },
      { activityId: 2, eligible: 1, completed: 1, rate: 1, recurrence: { frequency: "semanal", timezone: "America/Buenos_Aires" } },
    ],
  );
  const forbidden = await context.request(`/api/progreso/proyectos/1?asOf=${instant}`, { headers: auth(context, 3) });
  assert.equal(forbidden.status, 403);
  assert.equal((await forbidden.json()).error.code, "PROJECT_FORBIDDEN");
});
