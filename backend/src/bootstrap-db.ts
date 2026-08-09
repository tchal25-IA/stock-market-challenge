import { copyFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Sur Vercel : copie d'une DB pré-seedée vers /tmp (écriture possible).
 * En local : DATABASE_URL=file:./dev.db
 */
export async function ensureDatabase() {
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
