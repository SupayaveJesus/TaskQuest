const sqlite3 = require("sqlite3").verbose();
const { AsyncLocalStorage } = require("async_hooks");

function createDatabase(filename) {
  const nativeDb = new sqlite3.Database(filename);
  const native = {
    run: nativeDb.run.bind(nativeDb),
    get: nativeDb.get.bind(nativeDb),
    all: nativeDb.all.bind(nativeDb),
    close: nativeDb.close.bind(nativeDb),
  };
  const transactionContext = new AsyncLocalStorage();
  let commandTail = Promise.resolve();
  let savepointNumber = 0;
  let db;

  const isTransactionActive = () => transactionContext.getStore()?.active === true;
  const isTransactionControlStatement = (sql) => typeof sql === "string" && /^\s*(?:(?:--[^\r\n]*(?:\r?\n|$)|\/\*[\s\S]*?\*\/)\s*)*(?:BEGIN|COMMIT|END|ROLLBACK(?:\s+TO)?|SAVEPOINT|RELEASE)\b/i.test(sql);
  const enqueue = (work) => {
    const command = commandTail.then(work);
    commandTail = command.catch(() => {});
    return command;
  };

  const schedule = (method, args, trusted = false) => {
    const callback = typeof args.at(-1) === "function" ? args.pop() : null;
    const rejectTransactionControl = isTransactionActive()
      && !trusted
      && method === "run"
      && isTransactionControlStatement(args[0]);
    const execute = () => new Promise((resolve) => {
      const complete = function complete(error, ...results) {
        try {
          callback?.apply(this, [error, ...results]);
        } finally {
          resolve();
        }
      };

      try {
        if (rejectTransactionControl) {
          complete.call(nativeDb, new Error("Transaction-control statements are managed by withTransaction"));
        } else {
          native[method](...args, complete);
        }
      } catch (error) {
        complete.call(nativeDb, error);
      }
    });

    return isTransactionActive() ? execute() : enqueue(execute);
  };

  const runAsync = (...args) => new Promise((resolve, reject) => {
    db.run(...args, function onRun(error) {
      if (error) return reject(error);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

  const runTrustedAsync = (...args) => new Promise((resolve, reject) => {
    schedule("run", [...args, function onRun(error) {
      if (error) return reject(error);
      resolve({ lastID: this.lastID, changes: this.changes });
    }], true);
  });

  const getAsync = (...args) => new Promise((resolve, reject) => {
    db.get(...args, (error, row) => error ? reject(error) : resolve(row));
  });

  const allAsync = (...args) => new Promise((resolve, reject) => {
    db.all(...args, (error, rows) => error ? reject(error) : resolve(rows));
  });

  const withSavepoint = async (work) => {
    const name = `taskquest_nested_${++savepointNumber}`;
    await runTrustedAsync(`SAVEPOINT ${name}`);
    try {
      const result = await work();
      await runTrustedAsync(`RELEASE SAVEPOINT ${name}`);
      return result;
    } catch (error) {
      await runTrustedAsync(`ROLLBACK TO SAVEPOINT ${name}`).catch(() => {});
      await runTrustedAsync(`RELEASE SAVEPOINT ${name}`).catch(() => {});
      throw error;
    }
  };

  db = {
    // These preserve sqlite3's variadic binding signatures and callback receiver.
    run(...args) {
      schedule("run", args);
      return db;
    },
    get(...args) {
      schedule("get", args);
      return db;
    },
    all(...args) {
      schedule("all", args);
      return db;
    },
    runAsync,
    getAsync,
    allAsync,
    closeAsync() {
      const execute = () => new Promise((resolve, reject) => {
        native.close((error) => error ? reject(error) : resolve());
      });
      return isTransactionActive() ? execute() : enqueue(execute);
    },
    withTransaction(work) {
      if (isTransactionActive()) return withSavepoint(work);

      return enqueue(() => transactionContext.run({ active: true }, async () => {
        try {
          await runTrustedAsync("BEGIN IMMEDIATE");
          try {
            const result = await work();
            await runTrustedAsync("COMMIT");
            return result;
          } catch (error) {
            await runTrustedAsync("ROLLBACK").catch(() => {});
            throw error;
          }
        } finally {
          transactionContext.getStore().active = false;
        }
      }));
    },
  };

  db.run("PRAGMA foreign_keys = ON");
  return db;
}

module.exports = { createDatabase };
