
const path = require("path");
const { createDatabase } = require("../db/database");

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "..", "taskquest.db");
const db = createDatabase(dbPath);

module.exports = db;
