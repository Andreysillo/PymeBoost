require("dotenv").config();
const { initDatabase } = require("./config/database");
const app = require("./app");

const PORT = process.env.PORT || 5000;
const SQLITE_PATH = process.env.SQLITE_PATH || "./data/pymeboost.sqlite";

try {
  initDatabase();

  app.listen(PORT, () => {
    console.log(`SQLite database ready at ${SQLITE_PATH}`);
    console.log(`Backend running on http://localhost:${PORT}`);
  });
} catch (error) {
  console.error("SQLite initialization error:", error.message);
  process.exit(1);
}
