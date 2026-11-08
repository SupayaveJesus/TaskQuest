const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const { createDatabase } = require("../db/database");
const { migrate } = require("../db/migrate");

function temporaryDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "taskquest-migrations-"));
  return { directory, path: path.join(directory, "database.sqlite") };
}

test("migrations apply once on a fresh database and enforce foreign keys", async (t) => {
  const fixture = temporaryDatabase();
  const db = createDatabase(fixture.path);
  t.after(async () => {
    await db.closeAsync();
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });

  await migrate(db);
  await migrate(db);
  const migrations = await db.allAsync("SELECT name FROM schema_migrations ORDER BY name");
  assert.deepEqual(migrations.map(({ name }) => name), ["001-initial-schema.js", "002-completion-audit.js"]);
  await assert.rejects(
    db.runAsync("INSERT INTO actividades (titulo, usuario_id) VALUES (?, ?)", ["Invalid", 999]),
    /FOREIGN KEY constraint failed/,
  );
});

test("completion audit migration preserves legacy completion rows with owner backfill", async (t) => {
  const fixture = temporaryDatabase();
  const db = createDatabase(fixture.path);
  t.after(async () => {
    await db.closeAsync();
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });
  await db.runAsync("CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, correo TEXT UNIQUE NOT NULL, password TEXT NOT NULL, puntos INTEGER DEFAULT 0)");
  await db.runAsync("CREATE TABLE actividades (id INTEGER PRIMARY KEY, titulo TEXT NOT NULL, usuario_id INTEGER NOT NULL)");
  await db.runAsync("CREATE TABLE actividad_cumplimientos (id INTEGER PRIMARY KEY, actividad_id INTEGER NOT NULL, fecha TEXT NOT NULL, puntos INTEGER DEFAULT 10, UNIQUE(actividad_id, fecha))");
  await db.runAsync("INSERT INTO usuarios (id, nombre, correo, password) VALUES (1, 'Owner', 'owner@test.dev', 'hash')");
  await db.runAsync("INSERT INTO actividades (id, titulo, usuario_id) VALUES (4, 'Legacy', 1)");
  await db.runAsync("INSERT INTO actividad_cumplimientos (id, actividad_id, fecha, puntos) VALUES (7, 4, '2026-11-08', 15)");

  await migrate(db);
  const completion = await db.getAsync("SELECT id, actividad_id, actor_usuario_id, fecha, puntos FROM actividad_cumplimientos");
  assert.deepEqual(completion, { id: 7, actividad_id: 4, actor_usuario_id: 1, fecha: "2026-11-08", puntos: 15 });
  await assert.rejects(
    db.runAsync("INSERT INTO actividad_cumplimientos (actividad_id, actor_usuario_id, fecha) VALUES (4, 999, '2026-11-09')"),
    /FOREIGN KEY constraint failed/,
  );
});
