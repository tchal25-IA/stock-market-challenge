# Déploiement Stock Market Challenge

## État actuel (autonomy)

| Cible | URL | Statut |
|-------|-----|--------|
| **API Phase 1.1 (tunnel)** | https://letters-seen-angel-clinics.trycloudflare.com/api | Live tant que l’agent/tunnel tourne |
| **App web (CF preview)** | https://smc-web.pyrite-hound.workers.dev | Preview temporaire — claim Cloudflare requis pour garder |
| **Vercel prod (historique)** | https://stock-market-challenge.vercel.app + `-api` | Encore **ancien** build (Phase 1) |

Claim preview Cloudflare (≈60 min) :
https://dash.cloudflare.com/claim-preview?claimToken=LsNQbNAkL47oV50CK89XEQm-LCz3nUrHBeCPbFACAzM

## Remettre Vercel en prod (permanent)

Ajouter les secrets GitHub puis relancer **Actions → Deploy Vercel** :

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID_API`
- `VERCEL_PROJECT_ID_MOBILE`

Ou Redeploy manuel depuis le dashboard Vercel (projets `stock-market-challenge-api` + `stock-market-challenge`, branche `main`).

## Build local

```bash
npm ci
cd backend && npm run bake:db && npm run build && DATABASE_URL="file:./prisma/seed.db" npm run start:prod
# autre terminal
cd mobile && EXPO_PUBLIC_API_URL=http://localhost:3001/api npx expo start --web
```
