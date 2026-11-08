const sqlite3 = require("sqlite3").verbose();

function createDatabase(filename) {
  const db = new sqlite3.Database(filename);

  db.runAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) return reject(error);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

  db.getAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
  });

  db.allAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
  });

  db.closeAsync = () => new Promise((resolve, reject) => {
    db.close((error) => error ? reject(error) : resolve());
  });

  db.run("PRAGMA foreign_keys = ON");
  return db;
}

module.exports = { createDatabase };
