// One-off copy of all profiles and leave entries from Supabase into MySQL.
// Run after schema.sql:  npm run import-supabase
// Safe to re-run: rows whose id already exists in MySQL are left untouched.

const mysql = require('mysql2/promise');
const dbConfig = require('../db-config');
const { importRows } = require('./import-common');

// The same publishable key the page used before the migration.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bqjtlemxbihnnsqhnrqq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_UBXiN3wtRyJVYIXd-c9zrg_Tw90LHlC';
const PAGE_SIZE = 1000;

async function fetchAll(table) {
	const rows = [];
	for (let offset = 0; ; offset += PAGE_SIZE) {
		const res = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?select=*&order=id.asc&limit=' + PAGE_SIZE + '&offset=' + offset, {
			headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
		});
		if (!res.ok) throw new Error(table + ': Supabase error ' + res.status + ' ' + await res.text());
		const page = await res.json();
		rows.push(...page);
		if (page.length < PAGE_SIZE) return rows;
	}
}

(async () => {
	const db = await mysql.createConnection(dbConfig());
	try {
		const profiles = await fetchAll('leave_profiles');
		const entries = await fetchAll('leave_entries');
		console.log('Fetched from Supabase: ' + profiles.length + ' profiles, ' + entries.length + ' entries');

		await importRows(db, profiles, entries);
	} finally {
		await db.end();
	}
})().catch(err => {
	console.error('Import failed: ' + err.message);
	process.exit(1);
});
