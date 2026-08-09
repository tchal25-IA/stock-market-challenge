#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'prisma');
const sqlite = path.join(root, 'schema.prisma');
const backup = path.join(root, 'schema.sqlite.backup.prisma');

if (!fs.existsSync(backup)) {
  console.error('Pas de backup SQLite (schema.sqlite.backup.prisma)');
  process.exit(1);
}
fs.copyFileSync(backup, sqlite);
console.log('Schéma SQLite restauré.');
