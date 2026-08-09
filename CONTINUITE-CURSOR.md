# Reprendre Stock Market Challenge (Mac + iPhone / Cursor)

## Nom du repo

**`stock-market-challenge`**  
URL : https://github.com/tchal25-IA/stock-market-challenge

## Mac (Cursor Desktop)

1. `File → Open Folder` **ou** clone :
   ```bash
   git clone https://github.com/tchal25-IA/stock-market-challenge.git
   cd stock-market-challenge
   ```
2. Ouvre ce dossier dans Cursor (pas le monorepo parent `Projets-IT-T-S-`).
3. Nouveau chat Agent → colle `PROMPT.md` si tu veux le contexte produit.
4. Local :
   ```bash
   npm install
   cd backend && npx prisma db push && npm run prisma:seed && npm run start:dev
   # autre terminal
   cd mobile && EXPO_PUBLIC_API_URL=http://localhost:3001/api npx expo start
   ```

## iPhone (Cursor Mobile)

1. Connecte-toi avec le **même compte Cursor** (`tchal25-IA` / compte GitHub lié).
2. Ouvre le dépôt **`tchal25-IA/stock-market-challenge`** (Cloud / GitHub).
3. Lance un **Cloud Agent** sur ce repo pour coder / corriger à distance.
4. Pour **jouer** à l’app : Safari → https://stock-market-challenge.vercel.app  
   (Expo Go natif = setup local Mac + tunnel, pas requis pour la démo web).

## Prod live

| Couche | URL |
|--------|-----|
| App | https://stock-market-challenge.vercel.app |
| API | https://stock-market-challenge-api.vercel.app/api |

Les conversations Cursor liées au dossier local suivent le workspace ; sur iPhone, privilégie le **repo GitHub** comme source de vérité.
