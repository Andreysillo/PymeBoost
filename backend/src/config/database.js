const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { initializeSchema } = require("../db/schema");
const { seedIfEmpty } = require("../db/seed");

let databaseInstance;

function getDatabasePath() {
  return process.env.SQLITE_PATH || path.join(__dirname, "../../data/pymeboost.sqlite");
}

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function initDatabase() {
  if (!databaseInstance) {
    const databasePath = getDatabasePath();
    ensureDirectory(databasePath);

    databaseInstance = new Database(databasePath);
    databaseInstance.pragma("journal_mode = WAL");
    initializeSchema(databaseInstance);
    seedIfEmpty(databaseInstance);
  }

  return databaseInstance;
}

function getDatabase() {
  return initDatabase();
}

function closeDatabase() {
  if (databaseInstance) {
    databaseInstance.close();
    databaseInstance = undefined;
  }
}

module.exports = {
  closeDatabase,
  getDatabase,
  getDatabasePath,
  initDatabase,
};
