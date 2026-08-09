#!/usr/bin/env node
/**
 * Active le schéma Postgres (copie schema.postgresql.prisma → schema.prisma).
 * Usage: node scripts/use-postgres.js && DATABASE_URL=... npx prisma db push
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'prisma');
const sqlite = path.join(root, 'schema.prisma');
const pg = path.join(root, 'schema.postgresql.prisma');
const backup = path.join(root, 'schema.sqlite.backup.prisma');

if (!fs.existsSync(pg)) {
  console.error('schema.postgresql.prisma manquant');
  process.exit(1);
}

if (!fs.existsSync(backup)) {
  fs.copyFileSync(sqlite, backup);
}
fs.copyFileSync(pg, sqlite);
console.log('Schéma Postgres activé. Restaurer SQLite: node scripts/use-sqlite.js');
