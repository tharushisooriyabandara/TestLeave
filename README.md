# Leave Logs

Delivergate leave tracker. The page (`index.html`) is served by a small Node server (`server.js`) that stores everything in MySQL.

## Requirements

- Node.js 21.7 or newer
- MySQL 8.0.16 or newer

## Setup

1. Install dependencies:

   ```
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your MySQL connection details.

3. Create the database and tables:

   ```
   npm run setup-db
   ```

   This creates the `leave_logs` database and one admin account with PIN `0000`.

4. Start the server:

   ```
   npm start
   ```

   Open http://localhost:3000 and sign in with PIN `0000`. Change that PIN straight away under **Edit profile**.

Always open the page through the server. Opening `index.html` directly as a file won't work, because the page loads its data from the server's `/api` routes.

## Moving existing data from Supabase

After step 3, run:

```
npm run import-supabase
```

This copies every profile and leave entry from the old Supabase project into MySQL. You can run it more than once: rows that are already in MySQL are skipped. Any row that can't be copied is listed with the reason, for example an entry for a user that no longer exists.

To restore from a Supabase backup file (**Database → Backups** in the Supabase dashboard) instead:

```
npm run import-backup -- "db_cluster-17-09-2026@07-35-19.backup"
```

Both commands skip leave entries whose `user_id` isn't a profile. These are entries from before profiles existed, and the app never showed them. The skipped entries are listed so you can check them. Backup files contain every PIN, and `.gitignore` excludes `*.backup` so they never reach GitHub.

If one of your existing users has PIN `0000`, delete the seeded admin before importing:

```
mysql -u root -p leave_logs -e "DELETE FROM leave_profiles WHERE id = 'prof_admin'"
```

## Deploying to Vercel

Vercel serves `index.html` as a static page and runs the API in `api/index.js` (`vercel.json` routes `/api/*` there). The database must be online, since Vercel can't reach a MySQL on your laptop.

1. Create an online MySQL 8 database, for example a free Aiven for MySQL service.
2. Put its connection details in `.env`, including `DB_SSL_CA`, then run `npm run setup-db`.
3. In Vercel, open **Project Settings → Environment Variables** and add `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` and `DB_SSL_CA` with the same values.
4. Push to GitHub. Vercel redeploys automatically.

Never commit `.env`: it holds the database password, and `.gitignore` already excludes it.

## Security

PINs are checked in the browser, and the API has no login of its own. Anyone who can reach the server can read or change every record, including the PINs shown in the admin user list. Only run the server where it's reachable by people you trust, such as the office network or a VPN.

## Backups

Your data is stored in the Docker volume `leavelogs-data`. It survives restarts and container re-creation. It is lost only if Docker Desktop is uninstalled or reset, or the disk fails. Keep backup files outside Docker to guard against that:

```powershell
powershell -ExecutionPolicy Bypass -File backup.ps1
```

This saves `backups\leave_logs_<date>.sql` and keeps the newest 30. Backups contain PINs, so store them somewhere private.

To restore a backup (this replaces the current data):

```powershell
docker cp backups\leave_logs_2026-09-24_2044.sql leavelogs-mysql:/tmp/restore.sql
docker exec -e MYSQL_PWD=<DB_PASSWORD from .env> leavelogs-mysql sh -c "mysql -uroot --default-character-set=utf8mb4 < /tmp/restore.sql"
```
