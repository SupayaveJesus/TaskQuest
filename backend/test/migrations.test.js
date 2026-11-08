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

test("completion audit migration aborts without replacing orphaned legacy rows", async (t) => {
  const fixture = temporaryDatabase();
  const db = createDatabase(fixture.path);
  t.after(async () => {
    await db.closeAsync();
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });
  await db.runAsync("CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, correo TEXT UNIQUE NOT NULL, password TEXT NOT NULL, puntos INTEGER DEFAULT 0)");
  await db.runAsync("CREATE TABLE actividades (id INTEGER PRIMARY KEY, titulo TEXT NOT NULL, usuario_id INTEGER NOT NULL)");
  await db.runAsync("CREATE TABLE actividad_cumplimientos (id INTEGER PRIMARY KEY, actividad_id INTEGER NOT NULL, fecha TEXT NOT NULL, puntos INTEGER DEFAULT 10, UNIQUE(actividad_id, fecha))");
  await db.runAsync("INSERT INTO actividad_cumplimientos (id, actividad_id, fecha, puntos) VALUES (9, 404, '2026-11-08', 15)");

  await assert.rejects(
    migrate(db),
    /Migration 002-completion-audit\.js failed: Cannot migrate completion audit: legacy completion 9 references missing activity 404/,
  );

  const completion = await db.getAsync("SELECT id, actividad_id, fecha, puntos FROM actividad_cumplimientos");
  assert.deepEqual(completion, { id: 9, actividad_id: 404, fecha: "2026-11-08", puntos: 15 });
  const schema = await db.allAsync("PRAGMA table_info(actividad_cumplimientos)");
  assert.equal(schema.some(({ name }) => name === "actor_usuario_id"), false);
  const migration = await db.getAsync("SELECT name FROM schema_migrations WHERE name = ?", ["002-completion-audit.js"]);
  assert.equal(migration, undefined);
});

test("migration rollback restores legacy completion data after an injected post-copy failure", async (t) => {
  const fixture = temporaryDatabase();
  const db = createDatabase(fixture.path);
  const completionAuditPath = require.resolve("../db/migrations/002-completion-audit");
  const completionAudit = require(completionAuditPath);
  t.after(async () => {
    require.cache[completionAuditPath].exports = completionAudit;
    await db.closeAsync();
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });
  await db.runAsync("CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, correo TEXT UNIQUE NOT NULL, password TEXT NOT NULL, puntos INTEGER DEFAULT 0)");
  await db.runAsync("CREATE TABLE actividades (id INTEGER PRIMARY KEY, titulo TEXT NOT NULL, usuario_id INTEGER NOT NULL)");
  await db.runAsync("CREATE TABLE actividad_cumplimientos (id INTEGER PRIMARY KEY, actividad_id INTEGER NOT NULL, fecha TEXT NOT NULL, puntos INTEGER DEFAULT 10, UNIQUE(actividad_id, fecha))");
  await db.runAsync("INSERT INTO usuarios (id, nombre, correo, password) VALUES (1, 'Owner', 'owner@test.dev', 'hash')");
  await db.runAsync("INSERT INTO actividades (id, titulo, usuario_id) VALUES (4, 'Legacy', 1)");
  await db.runAsync("INSERT INTO actividad_cumplimientos (id, actividad_id, fecha, puntos) VALUES (7, 4, '2026-11-08', 15)");

  require.cache[completionAuditPath].exports = {
    async up(testDb) {
      await testDb.runAsync("ALTER TABLE actividad_cumplimientos RENAME TO actividad_cumplimientos_legacy");
      await testDb.runAsync("CREATE TABLE actividad_cumplimientos (id INTEGER PRIMARY KEY, actividad_id INTEGER NOT NULL, actor_usuario_id INTEGER NOT NULL, fecha TEXT NOT NULL, puntos INTEGER NOT NULL)");
      await testDb.runAsync(`INSERT INTO actividad_cumplimientos (id, actividad_id, actor_usuario_id, fecha, puntos)
        SELECT c.id, c.actividad_id, a.usuario_id, c.fecha, c.puntos
        FROM actividad_cumplimientos_legacy c
        JOIN actividades a ON a.id = c.actividad_id`);
      throw new Error("injected post-copy failure");
    },
  };

  await assert.rejects(migrate(db), /Migration 002-completion-audit\.js failed: injected post-copy failure/);

  const completion = await db.getAsync("SELECT id, actividad_id, fecha, puntos FROM actividad_cumplimientos");
  assert.deepEqual(completion, { id: 7, actividad_id: 4, fecha: "2026-11-08", puntos: 15 });
  const schema = await db.allAsync("PRAGMA table_info(actividad_cumplimientos)");
  assert.equal(schema.some(({ name }) => name === "actor_usuario_id"), false);
  const temporaryTable = await db.getAsync("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", ["actividad_cumplimientos_legacy"]);
  assert.equal(temporaryTable, undefined);
  const migration = await db.getAsync("SELECT name FROM schema_migrations WHERE name = ?", ["002-completion-audit.js"]);
  assert.equal(migration, undefined);
});

test("completion repository records its caller as the required completion actor", async (t) => {
  const fixture = temporaryDatabase();
  const db = createDatabase(fixture.path);
  const originalDatabasePath = process.env.DATABASE_PATH;
  let repositoryDb;
  t.after(async () => {
    await repositoryDb?.closeAsync();
    await db.closeAsync();
    if (originalDatabasePath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = originalDatabasePath;
    delete require.cache[require.resolve("../repositories/cumplimiento.repository")];
    delete require.cache[require.resolve("../config/database")];
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  });

  await migrate(db);
  await db.runAsync("INSERT INTO usuarios (id, nombre, correo, password) VALUES (1, 'Owner', 'owner@test.dev', 'hash')");
  await db.runAsync("INSERT INTO usuarios (id, nombre, correo, password) VALUES (2, 'Actor', 'actor@test.dev', 'hash')");
  await db.runAsync("INSERT INTO actividades (id, titulo, usuario_id) VALUES (4, 'Audited', 1)");

  process.env.DATABASE_PATH = fixture.path;
  delete require.cache[require.resolve("../repositories/cumplimiento.repository")];
  delete require.cache[require.resolve("../config/database")];
  const repository = require("../repositories/cumplimiento.repository");
  await repository.registrarCumplimiento(4, 2, "2026-11-08");
  repositoryDb = require("../config/database");

  const completion = await new Promise((resolve, reject) => {
    repositoryDb.get(
      "SELECT actividad_id, actor_usuario_id, fecha, puntos FROM actividad_cumplimientos",
      (error, row) => error ? reject(error) : resolve(row),
    );
  });
  assert.deepEqual(completion, { actividad_id: 4, actor_usuario_id: 2, fecha: "2026-11-08", puntos: 10 });
});
