-- Leave Logs database schema for MySQL 8.0.16+.
-- Run once:  mysql -u root -p < schema.sql
-- Safe to re-run: tables and the seed admin are only created if missing.

CREATE DATABASE IF NOT EXISTS leave_logs
	CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE leave_logs;

-- ── Profiles (one row per employee) ─────────────────────────────
CREATE TABLE IF NOT EXISTS leave_profiles (
	id                 VARCHAR(64)  NOT NULL,            -- app generates 'prof_<timestamp>_<rand>'
	name               VARCHAR(120) NOT NULL,
	pin                CHAR(4)      NOT NULL,            -- sign-in PIN; unique so login finds one user
	join_date          DATE         NULL,
	role               VARCHAR(10)  NOT NULL DEFAULT 'user',
	career_timeline    JSON         NULL,                -- [{"title","from","to"|null}]
	leave_entitlements JSON         NULL,                -- [{"from","to","annual","casual"}]
	created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	UNIQUE KEY leave_profiles_pin_uq (pin),
	CONSTRAINT leave_profiles_pin_chk  CHECK (pin REGEXP '^[0-9]{4}$'),
	CONSTRAINT leave_profiles_role_chk CHECK (role IN ('user', 'admin'))
) ENGINE=InnoDB;

-- ── Leave entries (one row per leave day) ───────────────────────
CREATE TABLE IF NOT EXISTS leave_entries (
	id           VARCHAR(64) NOT NULL,                   -- app generates 'id_<timestamp>_<rand>'
	user_id      VARCHAR(64) NOT NULL,
	type         VARCHAR(10) NOT NULL,
	`date`       DATE        NOT NULL,
	full_or_half VARCHAR(10) NOT NULL,
	notes        TEXT        NULL,
	join_date    DATE        NULL,                       -- snapshot of the employee's join date when saved
	created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	-- The app always loads entries per user within a date range, newest first.
	KEY leave_entries_user_date_idx (user_id, `date`),
	CONSTRAINT leave_entries_user_fk FOREIGN KEY (user_id)
		REFERENCES leave_profiles (id) ON DELETE CASCADE,
	CONSTRAINT leave_entries_type_chk CHECK (type IN ('annual', 'casual')),
	CONSTRAINT leave_entries_full_or_half_chk CHECK (full_or_half IN ('full', 'half', 'covered'))
) ENGINE=InnoDB;

-- ── First admin ─────────────────────────────────────────────────
-- The app has no sign-up screen: only an admin can add users. Seed one admin,
-- then sign in with this PIN and change it under Edit profile.
-- Skip this if you are importing existing users from Supabase instead.
INSERT IGNORE INTO leave_profiles (id, name, pin, join_date, role)
VALUES ('prof_admin', 'Administrator', '0000', '2025-03-03', 'admin');
