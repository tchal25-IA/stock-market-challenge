import { copyFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Résolution DB:
 * - DATABASE_URL postgres/neon/supabase → utilisé tel quel (prod durable)
 * - Vercel sans Postgres → copie seed.db SQLite vers /tmp
 * - Local sans URL → sqlite file:./dev.db
 */
export async function ensureDatabase() {
  const url = process.env.DATABASE_URL ?? '';
  const isPostgres = /^postgres(ql)?:\/\//i.test(url);

  if (isPostgres) {
    return;
  }

  if (process.env.VERCEL) {
    const target = '/tmp/smc.db';
    process.env.DATABASE_URL = `file:${target}`;
    if (!existsSync(target)) {
      const baked = join(__dirname, '..', 'prisma', 'seed.db');
      if (!existsSync(baked)) {
        throw new Error('prisma/seed.db manquant — lancer npm run bake:db');
      }
      copyFileSync(baked, target);
    }
  } else if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'file:./dev.db';
  }
}
