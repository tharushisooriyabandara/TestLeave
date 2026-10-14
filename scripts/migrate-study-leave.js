// Adds study leave to an existing database: two profile columns, and 'study' as a leave type.
// Run:  npm run migrate-study-leave    (safe to re-run)

const mysql = require('mysql2/promise');
const dbConfig = require('../db-config');

(async () => {
	const cfg = dbConfig();
	const db = await mysql.createConnection(cfg);
	try {
		const [cols] = await db.query(
			"SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'leave_profiles'",
			[cfg.database]);
		const have = new Set(cols.map(r => r.c));
		if (!have.has('study_leave_enabled')) {
			await db.query('ALTER TABLE leave_profiles ADD COLUMN study_leave_enabled TINYINT(1) NOT NULL DEFAULT 0');
			console.log('Added leave_profiles.study_leave_enabled');
		}
		if (!have.has('study_leave_days')) {
			await db.query('ALTER TABLE leave_profiles ADD COLUMN study_leave_days DECIMAL(5,1) NOT NULL DEFAULT 0');
			console.log('Added leave_profiles.study_leave_days');
		}

		// Widen the leave type check so 'study' entries can be saved.
		const [[row]] = await db.query('SHOW CREATE TABLE leave_entries');
		const ddl = row['Create Table'];
		if (/leave_entries_type_chk/.test(ddl) && !/'study'/.test(ddl)) {
			await db.query('ALTER TABLE leave_entries DROP CONSTRAINT leave_entries_type_chk');
			await db.query("ALTER TABLE leave_entries ADD CONSTRAINT leave_entries_type_chk CHECK (type IN ('annual', 'casual', 'study'))");
			console.log("Leave type check now allows 'study'");
		}
		console.log('Study leave migration done on ' + cfg.host);
	} finally {
		await db.end();
	}
})().catch(err => {
	console.error('Migration failed: ' + err.message);
	process.exit(1);
});
