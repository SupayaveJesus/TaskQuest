
require("dotenv").config();

const db = require("./config/database");
const { migrate } = require("./db/migrate");
const { createApp } = require("./app");
const PORT = process.env.PORT || 3000;

async function start() {
  await migrate(db);
  const app = createApp();
  app.listen(PORT, () => console.log(`Servidor ejecutándose en http://localhost:${PORT}`));
}

start().catch((error) => {
  console.error("Unable to start TaskQuest API:", error.message);
  process.exitCode = 1;
});
