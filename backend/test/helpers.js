const fs = require("fs");
const os = require("os");
const path = require("path");
const jwt = require("jsonwebtoken");
const { createDatabase } = require("../db/database");
const { migrate } = require("../db/migrate");

async function createTestContext() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "taskquest-"));
  const databasePath = path.join(directory, "taskquest.db");
  const setupDb = createDatabase(databasePath);
  await migrate(setupDb);
  await setupDb.closeAsync();

  process.env.DATABASE_PATH = databasePath;
  process.env.JWT_SECRET = "test-secret-that-is-long-enough";
  process.env.CORS_ORIGIN = "http://allowed.test";
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(path.join(__dirname, ".."))) delete require.cache[key];
  }
  const { createApp } = require("../app");
  const app = createApp();
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address();

  return {
    databasePath,
    db: require("../config/database"),
    tokenFor: (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1h" }),
    request: (route, options = {}) => fetch(`http://127.0.0.1:${address.port}${route}`, options),
    async close() {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await this.db.closeAsync();
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}

module.exports = { createTestContext };
