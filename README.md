# Stock Market Challenge

Jeu de bourse fictive — Phase 1 (niveaux 1–10, 15 titres, unlock progressif).

## Déploiement

| Couche | Plateforme | URL |
|--------|------------|-----|
| App web (Expo) | **Vercel** | https://stock-market-challenge.vercel.app |
| API (NestJS) | **Vercel** | https://stock-market-challenge-api.vercel.app/api |
| Code | **GitHub** | https://github.com/tchal25-IA/stock-market-challenge |

> SQLite sur Vercel = demo / vertical slice. Pour une prod durable : PostgreSQL (Supabase/Neon).

## Structure

```
simulation/   # Prototype GBM Python
backend/      # NestJS + Prisma
mobile/       # Expo React Native (web/iOS/Android)
```

## Local

```bash
npm install
npm run sim:test && npm run sim:run
cd backend && npx prisma db push && npm run prisma:seed && npm run start:dev
# autre terminal
cd mobile && EXPO_PUBLIC_API_URL=http://localhost:3001/api npx expo start
```

## Docs

- [PHASE-0-CADRAGE.md](./PHASE-0-CADRAGE.md)
- [SPECIFICATIONS.md](./SPECIFICATIONS.md)
- [CONTINUITE-CURSOR.md](./CONTINUITE-CURSOR.md) — reprise Mac / iPhone via Cursor
