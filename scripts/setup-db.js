// Creates the database and tables from schema.sql, using the connection in .env.
// Run:  npm run setup-db    (safe to re-run)

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dbConfig = require('../db-config');

(async () => {
	const cfg = dbConfig({ multipleStatements: true });
	delete cfg.database; // schema.sql creates it
	const db = await mysql.createConnection(cfg);
	try {
		// TiDB ignores CHECK constraints unless this is on, so turn it on before creating the tables.
		const [[{ v }]] = await db.query('SELECT VERSION() AS v');
		if (/tidb/i.test(v)) await db.query('SET GLOBAL tidb_enable_check_constraint = ON');
		await db.query(fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8'));
		const [tables] = await db.query('SHOW TABLES FROM leave_logs');
		console.log('Database ready on ' + cfg.host + ': ' + tables.map(t => Object.values(t)[0]).join(', '));
	} finally {
		await db.end();
	}
})().catch(err => {
	console.error('Setup failed: ' + err.message);
	process.exit(1);
});
