const { execSync } = require('child_process');
const { existsSync, unlinkSync } = require('fs');
const { join } = require('path');

const dbPath = join(__dirname, '..', 'prisma', 'seed.db');
const url = `file:${dbPath}`;

if (existsSync(dbPath)) unlinkSync(dbPath);

execSync('npx prisma db push --skip-generate', {
  cwd: join(__dirname, '..'),
  env: { ...process.env, DATABASE_URL: url },
  stdio: 'inherit',
});

execSync('npx ts-node --transpile-only prisma/seed.ts', {
  cwd: join(__dirname, '..'),
  env: { ...process.env, DATABASE_URL: url },
  stdio: 'inherit',
});

console.log('Baked prisma/seed.db');
