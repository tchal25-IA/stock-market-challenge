# Déploiement Stock Market Challenge

## Prod (Phase 1.1 — live)

| Cible | URL | Statut |
|-------|-----|--------|
| **App web** | https://stock-market-challenge.vercel.app | Production Phase 1.1 |
| **API** | https://stock-market-challenge-api.vercel.app/api | Production Phase 1.1 (27 titres seed, niveaux 1–20) |
| **GitHub** | https://github.com/tchal25-IA/stock-market-challenge | `main` = source de vérité |

Redéployé le **2026-08-10** depuis le build cloud (Phase 1.1 + polish).

## CI GitHub Actions

Workflow : `.github/workflows/deploy-vercel.yml` (push `main`).

Secrets à configurer dans le repo (Settings → Secrets) pour l’auto-deploy :

| Secret | Valeur |
|--------|--------|
| `VERCEL_TOKEN` | Token créé sur https://vercel.com/account/tokens |
| `VERCEL_ORG_ID` | `team_aPfDQeOkJ6BFo2SIRmKLCtKI` |
| `VERCEL_PROJECT_ID_API` | `prj_tk477IJWRu8LQ7PJxgT2U3aC3ATg` |
| `VERCEL_PROJECT_ID_MOBILE` | `prj_fGDfI7G8gAaTdd5wyeaqVtRTwY88` |

Sans ces secrets, le workflow **skip** le deploy (exit 0) — d’où l’ancien build resté en prod jusqu’au redeploy manuel.

## Redeploy manuel

```bash
cd backend && vercel deploy --prod --yes --scope thibauds-projects-528bdc51
cd ../mobile && vercel deploy --prod --yes --scope thibauds-projects-528bdc51
```

## Build local

```bash
npm ci
cd backend && npm run bake:db && npm run build && DATABASE_URL="file:./prisma/seed.db" npm run start:prod
# autre terminal
cd mobile && EXPO_PUBLIC_API_URL=http://localhost:3001/api npx expo start --web
```
