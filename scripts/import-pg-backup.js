// Restores profiles and leave entries from a Supabase backup file (plain-text pg_dump) into MySQL.
// Run after setup-db:  npm run import-backup -- "db_cluster-17-09-2026@07-35-19.backup"
// Safe to re-run: rows whose id already exists in MySQL are left untouched.

const fs = require('fs');
const mysql = require('mysql2/promise');
const dbConfig = require('../db-config');
const { importRows } = require('./import-common');

// Undo Postgres COPY text escaping: \N is NULL; backslash escapes cover control characters.
function copyValue(raw) {
	if (raw === '\\N') return null;
	return raw.replace(/\\(x[0-9a-fA-F]{1,2}|[0-7]{1,3}|.)/g, (m, c) => {
		if (c[0] === 'x') return String.fromCharCode(parseInt(c.slice(1), 16));
		if (/^[0-7]/.test(c)) return String.fromCharCode(parseInt(c, 8));
		return { b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v' }[c] ?? c;
	});
}

// Reads the rows of `COPY public.<table> (...) FROM stdin;` as objects keyed by column name.
function readCopyBlock(dump, table) {
	const header = new RegExp('^COPY public\\.' + table + ' \\(([^)]*)\\) FROM stdin;$', 'm').exec(dump);
	if (!header) throw new Error('No data for ' + table + ' in this backup');
	const cols = header[1].split(',').map(c => c.trim());
	const rows = [];
	for (const line of dump.slice(header.index + header[0].length + 1).split('\n')) {
		if (line === '\\.') return rows;
		const vals = line.replace(/\r$/, '').split('\t').map(copyValue);
		rows.push(Object.fromEntries(cols.map((c, i) => [c, vals[i]])));
	}
	throw new Error('Unterminated data for ' + table);
}

(async () => {
	const file = process.argv[2];
	if (!file) throw new Error('Pass the backup file, e.g. npm run import-backup -- "db_cluster-....backup"');
	const dump = fs.readFileSync(file, 'utf8');
	const profiles = readCopyBlock(dump, 'leave_profiles');
	const entries = readCopyBlock(dump, 'leave_entries');
	console.log('Read from backup: ' + profiles.length + ' profiles, ' + entries.length + ' entries');

	const db = await mysql.createConnection(dbConfig());
	try {
		await importRows(db, profiles, entries);
	} finally {
		await db.end();
	}
})().catch(err => {
	console.error('Restore failed: ' + err.message);
	process.exit(1);
});
