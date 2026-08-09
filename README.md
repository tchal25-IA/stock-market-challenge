# Stock Market Challenge

Jeu de bourse fictive — Phase 1 (niveaux 1–10).

## Déploiement

| Couche | Plateforme | Notes |
|--------|------------|--------|
| App web (Expo) | **Vercel** | Jouable dans le navigateur |
| API (NestJS) | **Vercel** | Serverless + SQLite seedée (`/tmp`) |
| Code | **GitHub** | Repo dédié |

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
