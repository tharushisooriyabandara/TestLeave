// MySQL connection settings, read from environment variables (.env locally, Project Settings on Vercel).

const path = require('path');

try { process.loadEnvFile(path.join(__dirname, '.env')); } catch { /* no .env: use real env vars */ }

// Online MySQL (Aiven, TiDB, ...) requires TLS. DB_SSL_CA is the provider's CA certificate (PEM);
// "\n" escapes are accepted so it fits on one line. DB_SSL=true uses the system's trusted CAs instead.
function sslOptions() {
	const ca = process.env.DB_SSL_CA;
	if (ca) return { ca: ca.replace(/\\n/g, '\n') };
	if (process.env.DB_SSL === 'true') return {};
	return undefined;
}

module.exports = function dbConfig(overrides = {}) {
	return {
		host: process.env.DB_HOST || 'localhost',
		port: Number(process.env.DB_PORT) || 3306,
		user: process.env.DB_USER || 'root',
		password: process.env.DB_PASSWORD || '',
		database: process.env.DB_NAME || 'leave_logs',
		ssl: sslOptions(),
		...overrides
	};
};
