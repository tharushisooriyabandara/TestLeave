// Adds the covered-leave details (leave_entries.cover_details) to an existing database.
// Run:  npm run migrate-cover-details    (safe to re-run)

const mysql = require('mysql2/promise');
const dbConfig = require('../db-config');

(async () => {
	const cfg = dbConfig();
	const db = await mysql.createConnection(cfg);
	try {
		const [cols] = await db.query(
			"SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'leave_entries' AND COLUMN_NAME = 'cover_details'",
			[cfg.database]);
		if (!cols.length) {
			await db.query('ALTER TABLE leave_entries ADD COLUMN cover_details JSON NULL');
			console.log('Added leave_entries.cover_details');
		}
		console.log('Cover details migration done on ' + cfg.host);
	} finally {
		await db.end();
	}
})().catch(err => {
	console.error('Migration failed: ' + err.message);
	process.exit(1);
});
