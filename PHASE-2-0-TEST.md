# Phase 2.0 Vertical Slice — Test Manual

## Backend (API)

### Build & Seed
```bash
cd backend
npm ci
npm run build              # ✅ Compile sans erreur
npm run bake:db           # ✅ Génère 37 assets (niveaux 1-30)
```

### Démarrage local
```bash
cd workspace
npm install                # Install monorepo
DATABASE_URL="file:./backend/prisma/seed.db" PORT=3001 npm run dev:api
```

Endpoints ajoutés :
- `GET /api/leaderboard?by=portfolio` — classement par valeur portfolio
- `GET /api/leaderboard?by=level` — classement par niveau
- `GET /api/bots` — liste incluant Swing Trader (unlock niveau 21)
- `POST /api/bots/configure` — config des 2 bots (hold, swing)

### Smoke Test API
```bash
# Guest login
curl -X POST http://localhost:3001/api/auth/guest

# Token
TOKEN="<accessToken>"

# Market (vérifier 37 assets)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/market | jq '.totalCount'
# Attendu: 37

# Bots (vérifier 2 bots)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/bots | jq '.bots | length'
# Attendu: 2 (Hold + Swing)

# Leaderboard
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/leaderboard
```

## Frontend (Mobile Web)

### Build
```bash
cd mobile
npm ci
npm run export:web         # ✅ Build réussi (dist/)
```

### Démarrage local
```bash
cd mobile
EXPO_PUBLIC_API_URL=http://localhost:3001/api npx expo start --web
```

### Smoke Test UI
1. Ouvrir http://localhost:8081 (ou port affiché)
2. Connexion Guest
3. **Market** : vérifier que les 8 premiers assets s'affichent (swipe)
4. **Portfolio** : vérifier capital 10,000€ + niveau 1
5. **Bots** : vérifier 2 bots affichés (Hold déverrouillé niv. 11, Swing niv. 21)
6. **Leaderboard** : nouvel onglet visible, affiche "Top 100 · N joueurs"
   - Toggle Portfolio / Niveau
   - Highlight de votre position

### Test Progression Niveaux 21+
```bash
# Depuis Prisma Studio ou UPDATE SQL:
UPDATE User SET level = 21, cash = 50000 WHERE id = '<userId>';
```
Puis dans l'UI :
- **Market** : nouveaux assets BTC, ETH, SOLAR, ROBOT, etc. visibles
- **Bots** : Swing Trader déverrouillé et configurable
- **Bots actifs** : tick marché déclenche trades automatiques

## Checklist Phase 2.0

### ✅ Backend
- [x] 10 nouveaux assets (niveaux 21-30) dans `assets.catalog.ts`
- [x] Bot Swing Trader implémenté (achat sur baisse 1%+, vente sur gain 3%+)
- [x] Module Leaderboard (controller + service)
- [x] Export SWING_BOT_UNLOCK_LEVEL = 21
- [x] Build backend sans erreur
- [x] Seed DB avec 37 assets

### ✅ Frontend
- [x] Nouvel onglet "Classmt" dans tabs
- [x] Vue Leaderboard avec toggle Portfolio / Niveau
- [x] API client `leaderboard()` ajouté
- [x] Écran Bots affiche locked/unlocked + unlock level
- [x] Build mobile sans erreur

### 🔲 Tests à Faire (Manuel)
- [ ] Créer guest, atteindre niveau 11 → Hold Champion unlocked
- [ ] Atteindre niveau 21 → Swing Trader unlocked + nouveaux assets
- [ ] Activer Swing Trader → tick marché → vérifie trades auto dans History
- [ ] Créer 2+ users, vérifier classement Portfolio et Niveau
- [ ] Vérifier que currentUserRank s'affiche si hors top 100

## Notes Déploiement Vercel

Phase 1.1 déjà en prod :
- App : https://stock-market-challenge.vercel.app
- API : https://stock-market-challenge-api.vercel.app/api

Workflow CI : `.github/workflows/deploy-vercel.yml`

Pour redeploy automatique, configurer ces secrets dans le repo GitHub :
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID_API`
- `VERCEL_PROJECT_ID_MOBILE`

Ou redeploy manuel :
```bash
cd backend && vercel deploy --prod --yes --scope <votre-scope>
cd ../mobile && vercel deploy --prod --yes --scope <votre-scope>
```

**Build Vercel** : `npx prisma generate && npx nest build && node scripts/bake-db.js`
Le script `bake-db.js` génère automatiquement `prisma/seed.db` avec les 37 assets.
