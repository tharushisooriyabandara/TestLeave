// Adds the optional per-entry note (leave_entries.extra_note) to an existing database.
// Run:  npm run migrate-entry-note    (safe to re-run)

const mysql = require('mysql2/promise');
const dbConfig = require('../db-config');

(async () => {
	const cfg = dbConfig();
	const db = await mysql.createConnection(cfg);
	try {
		const [cols] = await db.query(
			"SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'leave_entries' AND COLUMN_NAME = 'extra_note'",
			[cfg.database]);
		if (!cols.length) {
			await db.query('ALTER TABLE leave_entries ADD COLUMN extra_note TEXT NULL');
			console.log('Added leave_entries.extra_note');
		}
		console.log('Entry note migration done on ' + cfg.host);
	} finally {
		await db.end();
	}
})().catch(err => {
	console.error('Migration failed: ' + err.message);
	process.exit(1);
});
