function initializeSchema(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pymes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_name TEXT NOT NULL,
      rfc TEXT,
      industry TEXT,
      size TEXT,
      employees INTEGER DEFAULT 0,
      email TEXT,
      phone TEXT,
      city TEXT DEFAULT 'CDMX',
      annual_revenue TEXT,
      areas TEXT,
      objectives TEXT,
      timeline TEXT,
      primary_area TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS advisors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      location TEXT DEFAULT 'CDMX',
      years_experience INTEGER DEFAULT 5,
      specialization TEXT,
      linkedin TEXT,
      education TEXT,
      certifications TEXT,
      industries TEXT,
      portfolio TEXT,
      methodology TEXT,
      company_sizes TEXT,
      retainer INTEGER DEFAULT 35000,
      bonus_percent REAL DEFAULT 15,
      availability TEXT,
      max_projects INTEGER DEFAULT 3,
      preferred_duration TEXT,
      projects_completed INTEGER DEFAULT 0,
      status TEXT DEFAULT 'approved',
      bio TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sme_id INTEGER NOT NULL,
      advisor_id INTEGER NOT NULL,
      message TEXT,
      status TEXT DEFAULT 'pending',
      match_score INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (sme_id) REFERENCES pymes(id),
      FOREIGN KEY (advisor_id) REFERENCES advisors(id)
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sme_id INTEGER NOT NULL,
      advisor_id INTEGER NOT NULL,
      application_id INTEGER,
      area TEXT,
      status TEXT DEFAULT 'pendiente',
      duration_months INTEGER DEFAULT 6,
      months_elapsed INTEGER DEFAULT 0,
      retainer INTEGER,
      bonus_percent REAL,
      kpis TEXT,
      start_date TEXT,
      end_date TEXT,
      signed_sme INTEGER DEFAULT 0,
      signed_advisor INTEGER DEFAULT 0,
      milestones_completed INTEGER DEFAULT 0,
      milestones_total INTEGER DEFAULT 5,
      next_milestone TEXT,
      contract_body TEXT,
      guarantee_fund INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (sme_id) REFERENCES pymes(id),
      FOREIGN KEY (advisor_id) REFERENCES advisors(id)
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sme_id INTEGER NOT NULL,
      advisor_id INTEGER NOT NULL,
      contract_id INTEGER,
      project_name TEXT,
      FOREIGN KEY (sme_id) REFERENCES pymes(id),
      FOREIGN KEY (advisor_id) REFERENCES advisors(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_role TEXT NOT NULL,
      sender_id INTEGER,
      body TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );

    CREATE TABLE IF NOT EXISTS disputes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL,
      reported_by TEXT,
      description TEXT,
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (contract_id) REFERENCES contracts(id)
    );

    CREATE TABLE IF NOT EXISTS additional_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL,
      description TEXT,
      duration TEXT,
      objectives TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (contract_id) REFERENCES contracts(id)
    );
  `);
}

module.exports = { initializeSchema };
