// Shared by the Supabase importers: inserts profiles, then leave entries, into MySQL.
// Rows whose id already exists are left untouched, so imports are safe to re-run.

const ymd = v => (v ? String(v).slice(0, 10) : null);
const json = v => JSON.stringify(typeof v === 'string' ? JSON.parse(v || '[]') : (v || []));
// Postgres '2026-05-08 10:58:31.367959+00' → MySQL '2026-05-08 10:58:31' (UTC).
const timestamp = v => (v ? new Date(String(v).replace(' ', 'T').replace(/\+00$/, 'Z')).toISOString().slice(0, 19).replace('T', ' ') : undefined);

const toProfile = p => ({
	id: p.id,
	name: p.name,
	pin: p.pin,
	join_date: ymd(p.join_date),
	role: p.role || 'user',
	career_timeline: json(p.career_timeline),
	leave_entitlements: json(p.leave_entitlements)
});

const toEntry = e => {
	const row = {
		id: e.id,
		user_id: e.user_id,
		type: e.type,
		date: ymd(e.date),
		full_or_half: e.full_or_half,
		notes: e.notes,
		join_date: ymd(e.join_date)
	};
	const created = timestamp(e.created_at);
	if (created) row.created_at = created;
	return row;
};

async function insertAll(db, table, rows, toRow) {
	let added = 0, existing = 0;
	const failed = [];
	for (const r of rows) {
		try {
			const [found] = await db.query('SELECT 1 FROM ' + table + ' WHERE id = ?', [r.id]);
			if (found.length) { existing++; continue; }
			// Plain INSERT (not INSERT IGNORE) so constraint failures are reported, not skipped silently.
			await db.query('INSERT INTO ' + table + ' SET ?', [toRow(r)]);
			added++;
		} catch (err) {
			failed.push(r.id + ': ' + (err.sqlMessage || err.message));
		}
	}
	console.log(table + ': ' + added + ' added, ' + existing + ' already present, ' + failed.length + ' failed');
	failed.forEach(f => console.log('  ✗ ' + f));
}

async function importRows(db, profiles, entries) {
	// Profiles first: entries reference them.
	await insertAll(db, 'leave_profiles', profiles, toProfile);

	// Entries from before profiles existed use a name or PIN as user_id. The app never shows
	// them, so they are skipped and listed rather than failing on the foreign key.
	const [ids] = await db.query('SELECT id FROM leave_profiles');
	const known = new Set(ids.map(r => r.id));
	const orphans = entries.filter(e => !known.has(e.user_id));
	await insertAll(db, 'leave_entries', entries.filter(e => known.has(e.user_id)), toEntry);
	if (orphans.length) {
		console.log('Skipped ' + orphans.length + ' entries whose user_id is not a profile:');
		orphans.forEach(e => console.log('  - ' + e.id + '  user_id=' + e.user_id + '  ' + ymd(e.date) + ' ' + e.type + '/' + e.full_or_half + (e.notes ? '  "' + e.notes + '"' : '')));
	}
}

module.exports = { importRows };
