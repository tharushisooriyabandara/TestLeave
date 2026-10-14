// Adds study leave to an existing database by allowing 'study' as a leave type.
// Study days per leave year live in leave_profiles.leave_entitlements ("study" on each year).
// Run:  npm run migrate-study-leave    (safe to re-run)

const mysql = require('mysql2/promise');
const dbConfig = require('../db-config');

(async () => {
	const cfg = dbConfig();
	const db = await mysql.createConnection(cfg);
	try {
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
