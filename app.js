// Leave Logs JSON API backed by MySQL. Used by server.js locally and by api/index.js on Vercel.

const express = require('express');
const mysql = require('mysql2/promise');
const dbConfig = require('./db-config');

const pool = mysql.createPool(dbConfig({
	dateStrings: true, // keep DATE columns as 'YYYY-MM-DD', never shifted by time zone
	connectionLimit: Number(process.env.DB_POOL_SIZE) || 5
}));

// Columns a client may write. Anything else in a request body is ignored.
const PROFILE_FIELDS = ['id', 'name', 'pin', 'join_date', 'role', 'career_timeline', 'leave_entitlements'];
const ENTRY_FIELDS = ['id', 'user_id', 'type', 'date', 'full_or_half', 'notes', 'join_date'];
const JSON_FIELDS = new Set(['career_timeline', 'leave_entitlements']);

function pick(body, fields) {
	const out = {};
	for (const f of fields) {
		if (!body || body[f] === undefined) continue;
		out[f] = JSON_FIELDS.has(f) ? JSON.stringify(body[f] || []) : body[f];
	}
	return out;
}

function badRequest(message) {
	return Object.assign(new Error(message), { status: 400 });
}

// MySQL returns JSON columns as objects; MariaDB returns them as strings.
function parseJsonColumn(v) {
	if (v == null) return [];
	if (typeof v !== 'string') return v;
	try { return JSON.parse(v); } catch { return []; }
}

const app = express();
app.use(express.json());

// ── Profiles ────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
	const pin = String((req.body && req.body.pin) || '').trim();
	const [rows] = await pool.query(
		'SELECT id, name, join_date, role FROM leave_profiles WHERE pin = ?', [pin]);
	res.json(rows[0] || null);
});

app.get('/api/profiles', async (req, res) => {
	const [rows] = await pool.query(
		'SELECT id, name, join_date, role, pin FROM leave_profiles ORDER BY name');
	res.json(rows);
});

app.get('/api/profiles/:id', async (req, res) => {
	const [rows] = await pool.query(
		'SELECT id, name, join_date, role, career_timeline, leave_entitlements FROM leave_profiles WHERE id = ?',
		[req.params.id]);
	const p = rows[0];
	if (!p) return res.json(null);
	p.career_timeline = parseJsonColumn(p.career_timeline);
	p.leave_entitlements = parseJsonColumn(p.leave_entitlements);
	res.json(p);
});

app.post('/api/profiles', async (req, res) => {
	const row = pick(req.body, PROFILE_FIELDS);
	if (!row.id || !row.name || !row.pin) throw badRequest('id, name and pin are required');
	await pool.query('INSERT INTO leave_profiles SET ?', [row]);
	res.status(201).json({ id: row.id });
});

app.patch('/api/profiles/:id', async (req, res) => {
	const patch = pick(req.body, PROFILE_FIELDS.filter(f => f !== 'id'));
	if (!Object.keys(patch).length) throw badRequest('Nothing to update');
	await pool.query('UPDATE leave_profiles SET ? WHERE id = ?', [patch, req.params.id]);
	res.json({ id: req.params.id });
});

// Deletes the profile; its leave entries go with it (ON DELETE CASCADE).
app.delete('/api/profiles/:id', async (req, res) => {
	await pool.query('DELETE FROM leave_profiles WHERE id = ?', [req.params.id]);
	res.status(204).end();
});

// ── Leave entries ───────────────────────────────────────────────
app.get('/api/entries', async (req, res) => {
	const { user_id, from, to } = req.query;
	if (!user_id || !from || !to) throw badRequest('user_id, from and to are required');
	const [rows] = await pool.query(
		'SELECT id, user_id, type, `date`, full_or_half, notes, join_date FROM leave_entries ' +
		'WHERE user_id = ? AND `date` BETWEEN ? AND ? ORDER BY `date` DESC',
		[user_id, from, to]);
	res.json(rows);
});

app.post('/api/entries', async (req, res) => {
	const row = pick(req.body, ENTRY_FIELDS);
	if (!row.id || !row.user_id) throw badRequest('id and user_id are required');
	await pool.query('INSERT INTO leave_entries SET ?', [row]);
	res.status(201).json({ id: row.id });
});

// Saves several entries (e.g. a date range) in one transaction: all or nothing.
app.post('/api/entries/batch', async (req, res) => {
	const rows = (Array.isArray(req.body) ? req.body : []).map(b => pick(b, ENTRY_FIELDS));
	if (!rows.length) throw badRequest('Send an array of entries');
	if (rows.some(r => !r.id || !r.user_id)) throw badRequest('id and user_id are required');
	const values = rows.map(r => ENTRY_FIELDS.map(f => r[f] === undefined ? null : r[f]));
	const conn = await pool.getConnection();
	try {
		await conn.beginTransaction();
		await conn.query(
			'INSERT INTO leave_entries (id, user_id, type, `date`, full_or_half, notes, join_date) VALUES ?',
			[values]);
		await conn.commit();
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
	res.status(201).json({ ids: rows.map(r => r.id) });
});

app.patch('/api/entries/:id', async (req, res) => {
	const patch = pick(req.body, ENTRY_FIELDS.filter(f => f !== 'id' && f !== 'user_id'));
	if (!Object.keys(patch).length) throw badRequest('Nothing to update');
	await pool.query('UPDATE leave_entries SET ? WHERE id = ?', [patch, req.params.id]);
	res.json({ id: req.params.id });
});

app.delete('/api/entries/:id', async (req, res) => {
	await pool.query('DELETE FROM leave_entries WHERE id = ?', [req.params.id]);
	res.status(204).end();
});

// The page shows `message` in its toasts, and matches "duplicate" to spot a taken PIN.
app.use((err, req, res, next) => {
	const status = err.status || (err.code === 'ER_DUP_ENTRY' ? 409 : err.sqlMessage ? 400 : 500);
	if (status === 500) console.error(err);
	res.status(status).json({ message: err.sqlMessage || err.message || 'Server error' });
});

module.exports = app;
