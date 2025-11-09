const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.resolve(process.cwd(), 'data');
fs.mkdirSync(DB_DIR, { recursive: true });
const DB_FILE = path.join(DB_DIR, 'queue.db');

const db = new Database(DB_FILE);

// Run migration
try {
  const migrationPath = path.resolve(__dirname, '..', 'migrations', 'init.sql');
  if (fs.existsSync(migrationPath)) {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    db.exec(sql);
    console.log('✅ Database initialized and migrations applied.');
  } else {
    console.error('❌ Migration file not found:', migrationPath);
  }
} catch (err) {
  console.error('❌ Error running migrations:', err.message);
}

module.exports = db;
