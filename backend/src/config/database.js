const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

let databaseInstance;

function getDatabasePath() {
	return process.env.SQLITE_PATH || path.join(__dirname, "../../data/pymeboost.sqlite");
}

function ensureDirectory(filePath) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function initializeSchema(database) {
	database.exec(`
		PRAGMA foreign_keys = ON;

		CREATE TABLE IF NOT EXISTS app_metadata (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
	`);
}

function initDatabase() {
	if (!databaseInstance) {
		const databasePath = getDatabasePath();
		ensureDirectory(databasePath);

		databaseInstance = new Database(databasePath);
		databaseInstance.pragma("journal_mode = WAL");
		initializeSchema(databaseInstance);
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
