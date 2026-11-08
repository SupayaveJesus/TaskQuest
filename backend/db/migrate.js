const fs = require("fs");
const path = require("path");

const migrationsDirectory = path.join(__dirname, "migrations");

async function migrate(db) {
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const files = fs.readdirSync(migrationsDirectory)
    .filter((file) => /^\d+-.*\.js$/.test(file))
    .sort();

  for (const name of files) {
    const applied = await db.getAsync(
      "SELECT name FROM schema_migrations WHERE name = ?",
      [name],
    );
    if (applied) continue;

    const migration = require(path.join(migrationsDirectory, name));
    await db.runAsync("BEGIN IMMEDIATE");
    try {
      await migration.up(db);
      await db.runAsync("INSERT INTO schema_migrations (name) VALUES (?)", [name]);
      await db.runAsync("COMMIT");
    } catch (error) {
      await db.runAsync("ROLLBACK").catch(() => {});
      throw new Error(`Migration ${name} failed: ${error.message}`);
    }
  }
}

module.exports = { migrate };
