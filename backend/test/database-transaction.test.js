const assert = require("node:assert/strict");
const test = require("node:test");
const { createDatabase } = require("../db/database");

const waitForTurn = () => new Promise((resolve) => setImmediate(resolve));

const rawRun = (db, ...args) => new Promise((resolve, reject) => {
  db.run(...args, function onRun(error) {
    if (error) return reject(error);
    resolve({ lastID: this.lastID, changes: this.changes });
  });
});

const createFixture = async (t) => {
  const db = createDatabase(":memory:");
  t.after(() => db.closeAsync());
  await db.runAsync("CREATE TABLE writes (name TEXT NOT NULL)");
  return db;
};

test("an ordinary raw write waits for a committing transaction", async (t) => {
  const db = await createFixture(t);
  let releaseTransaction;
  const holdTransaction = new Promise((resolve) => { releaseTransaction = resolve; });
  let transactionStarted;
  const started = new Promise((resolve) => { transactionStarted = resolve; });

  const transaction = db.withTransaction(async () => {
    await db.runAsync("INSERT INTO writes (name) VALUES (?)", ["transaction"]);
    transactionStarted();
    await holdTransaction;
  });
  await started;

  let ordinarySettled = false;
  const ordinaryWrite = rawRun(db, "INSERT INTO writes (name) VALUES (?)", ["ordinary"])
    .then(() => { ordinarySettled = true; });
  await waitForTurn();
  assert.equal(ordinarySettled, false);

  releaseTransaction();
  await transaction;
  await ordinaryWrite;
  assert.deepEqual(await db.allAsync("SELECT name FROM writes ORDER BY rowid"), [
    { name: "transaction" },
    { name: "ordinary" },
  ]);
});

test("a raw write racing a rollback is not rolled back with the transaction", async (t) => {
  const db = await createFixture(t);
  let releaseTransaction;
  const holdTransaction = new Promise((resolve) => { releaseTransaction = resolve; });
  let transactionStarted;
  const started = new Promise((resolve) => { transactionStarted = resolve; });

  const transaction = db.withTransaction(async () => {
    await db.runAsync("INSERT INTO writes (name) VALUES (?)", ["transaction"]);
    transactionStarted();
    await holdTransaction;
    throw new Error("rollback transaction");
  });
  await started;

  let ordinarySettled = false;
  const ordinaryWrite = rawRun(db, "INSERT INTO writes (name) VALUES (?)", ["ordinary"])
    .then(() => { ordinarySettled = true; });
  await waitForTurn();
  assert.equal(ordinarySettled, false);

  releaseTransaction();
  await assert.rejects(transaction, /rollback transaction/);
  await ordinaryWrite;
  assert.deepEqual(await db.allAsync("SELECT name FROM writes"), [{ name: "ordinary" }]);
});

test("the facade retains sqlite3 variadic bindings, callbacks, and callback receivers", async (t) => {
  const db = await createFixture(t);
  const inserted = await rawRun(db, "INSERT INTO writes (name) VALUES (?)", "variadic");
  assert.equal(inserted.changes, 1);
  assert.equal(typeof inserted.lastID, "number");

  const row = await new Promise((resolve, reject) => {
    db.get("SELECT name FROM writes WHERE name = ?", "variadic", (error, result) => error ? reject(error) : resolve(result));
  });
  assert.deepEqual(row, { name: "variadic" });

  const rows = await new Promise((resolve, reject) => {
    db.all("SELECT name FROM writes WHERE name IN (?, ?)", "variadic", "missing", (error, result) => error ? reject(error) : resolve(result));
  });
  assert.deepEqual(rows, [{ name: "variadic" }]);
});

test("the controlled facade does not expose native SQLite bypass APIs", async (t) => {
  const db = await createFixture(t);
  assert.equal(db.exec, undefined);
  assert.equal(db.each, undefined);
  assert.equal(db.prepare, undefined);
  assert.equal(db.close, undefined);
});

test("a failed command does not block commands queued after it", async (t) => {
  const db = await createFixture(t);
  await assert.rejects(db.runAsync("INSERT INTO missing_table VALUES (1)"), /no such table/);
  await db.runAsync("INSERT INTO writes (name) VALUES (?)", ["after failure"]);
  assert.deepEqual(await db.allAsync("SELECT name FROM writes"), [{ name: "after failure" }]);
});

test("a caught nested transaction error rolls back only its savepoint", async (t) => {
  const db = await createFixture(t);
  await db.withTransaction(async () => {
    await db.runAsync("INSERT INTO writes (name) VALUES (?)", ["outer before"]);
    await assert.rejects(db.withTransaction(async () => {
      await db.runAsync("INSERT INTO writes (name) VALUES (?)", ["nested"]);
      throw new Error("nested failure");
    }), /nested failure/);
    await db.runAsync("INSERT INTO writes (name) VALUES (?)", ["outer after"]);
  });
  assert.deepEqual(await db.allAsync("SELECT name FROM writes ORDER BY rowid"), [
    { name: "outer before" },
    { name: "outer after" },
  ]);
});

test("an explicit COMMIT cannot escape an outer transaction rollback", async (t) => {
  const db = await createFixture(t);

  await assert.rejects(db.withTransaction(async () => {
    await assert.rejects(db.runAsync("COMMIT"), /managed by withTransaction/);
    await db.runAsync("INSERT INTO writes (name) VALUES (?)", ["after rejected commit"]);
    throw new Error("outer failure");
  }), /outer failure/);

  assert.deepEqual(await db.allAsync("SELECT name FROM writes"), []);
});

test("an explicit END cannot escape an outer transaction rollback through runAsync", async (t) => {
  const db = await createFixture(t);

  await assert.rejects(db.withTransaction(async () => {
    await assert.rejects(db.runAsync("END"), /managed by withTransaction/);
    await db.runAsync("INSERT INTO writes (name) VALUES (?)", ["after rejected end"]);
    throw new Error("outer failure");
  }), /outer failure/);

  assert.deepEqual(await db.allAsync("SELECT name FROM writes"), []);
});

test("an explicit END cannot escape an outer transaction rollback through db.run callback", async (t) => {
  const db = await createFixture(t);

  await assert.rejects(db.withTransaction(async () => {
    await assert.rejects(new Promise((resolve, reject) => {
      db.run("END", (error) => error ? reject(error) : resolve());
    }), /managed by withTransaction/);
    await db.runAsync("INSERT INTO writes (name) VALUES (?)", ["after rejected end callback"]);
    throw new Error("outer failure");
  }), /outer failure/);

  assert.deepEqual(await db.allAsync("SELECT name FROM writes"), []);
});
