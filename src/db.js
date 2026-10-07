// SQLite storage (node:sqlite, no dependency). Schema changes = append to MIGRATIONS.
import { DatabaseSync } from 'node:sqlite';

const MIGRATIONS = [
  `create table settings (key text primary key, value text not null);
   create table accounts (
     id text primary key,
     platform text not null,
     platform_user_id text not null,
     login text not null,
     display_name text,
     avatar text,
     scopes text not null default '',
     secret text,                       -- sealed tokens (crypto.seal)
     status text not null default 'ok', -- ok | needs_reconnect | error | disabled
     error text,
     options text not null default '{}',
     position integer not null default 0,
     created_at integer not null,
     updated_at integer not null,
     unique (platform, platform_user_id)
   );
   create table presets (id text primary key, name text not null, data text not null, position integer not null default 0, updated_at integer not null);
   create table seen_users (platform text not null, user_id text not null, first_seen integer not null, primary key (platform, user_id));`,
];

export function openDb(file) {
  const db = new DatabaseSync(file);
  // WAL + synchronous=normal: no corruption risk, no fsync per write on the event loop.
  db.exec('pragma journal_mode = wal; pragma synchronous = normal; pragma busy_timeout = 5000; pragma foreign_keys = on;');
  const { user_version: current } = db.prepare('pragma user_version').get();
  for (let i = current; i < MIGRATIONS.length; i++) {
    db.exec('begin');
    try {
      db.exec(MIGRATIONS[i]);
      db.exec(`pragma user_version = ${i + 1}`);
      db.exec('commit');
    } catch (err) {
      db.exec('rollback');
      throw err;
    }
  }
  return db;
}

export function settings(db) {
  const get = db.prepare('select value from settings where key = ?');
  const put = db.prepare('insert into settings (key, value) values (?, ?) on conflict (key) do update set value = excluded.value');
  const del = db.prepare('delete from settings where key = ?');
  return {
    get(key, fallback = null) {
      const row = get.get(key);
      return row ? JSON.parse(row.value) : fallback;
    },
    set(key, value) {
      if (value === undefined || value === null) del.run(key);
      else put.run(key, JSON.stringify(value));
    },
  };
}
