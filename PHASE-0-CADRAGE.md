# Stock Market Challenge — Phase 0 (cadrage validé)

**Statut :** Phase 0 terminée et validée. Phase 1 livrée (GBM + API + mobile swipe niveaux 1–10).

---

## Clarification produit

**Stock Market Challenge ≠ Quiz Rush / Tennis Manager.**  
Aucune réutilisation du gameplay, des écrans, du modèle de données métier, ni des flows des autres apps.  
La seule référence portefeuille est la **stack imposée** (Expo / React Native, NestJS, Prisma, PostgreSQL, Redis optionnel, JWT) — pas la structure produit d’un autre jeu.

---

## Cadrage MVP (1 page)

### Vision
Jeu de **portefeuille boursier 100 % fictif** : capital virtuel, swipe type Tinder pour trader, progression par niveaux, marché simulé (GBM). Dimension éducative, F2P sans pay-to-win.

### Boucle de session cible
**60–90 s :** ouvrir → portfolio → swipe acheter/ignorer → P&L → check objectif de niveau.

### Must-have Phase 1 (slice jouable)

| Bloc | Scope |
|------|--------|
| Progression | Niveaux **1–10** uniquement |
| Univers | **5 actions** blue-chip fictives, capital **10k€**, objectif **15k€** |
| Marché | **GBM partagé** + mean reversion + circuit breakers + events rares |
| Tick | Accéléré in-game (1 tick ≈ 1h de marché) |
| Trading | Achat / vente, cash, P&L, historique |
| UI | Swipe droite = buy, gauche = ignorer, tap = détail + graphique |
| Éducation | Tooltips + tuto niveau 1 |
| Auth | JWT minimal |

### Hors Phase 1 (V1.1+)
Niveaux 11–100, obligations, matières, cryptos, levier, bots, classement/challenges, TimescaleDB, WebSockets live, IAP, AWS/K8s.

### Modèle & KPIs
- F2P éthique (pas de pay-to-win)
- Cibles produit : D1 > 50 % · D7 > 30 % · D30 > 15 % ; session 3–5 min

### Domaines métier (propres à SMC)

```text
MarchePartage → SwipeTrading → PortfolioPnL → ProgressionNiveau → MarchePartage
```

Modules backend : `auth`, `market`, `portfolio`, `trading`, `progression`.

### Emplacement
Projet : ce dossier (`App-Mobile-LOCAL/stock-market-challenge/`).

---

## Options de démarrage (Phase 1)

1. **Prototype GBM Python** (retenu) — vérité métier du marché avant l’UI
2. Architecture monorepo d’abord
3. UI swipe mockée sans vrai marché
4. Vertical slice avec prix aléatoires
5. Leaderboard / challenges d’abord

---

## Décisions figées pour la Phase 1

| Décision | Choix |
|----------|--------|
| Option de démarrage | **1 — Prototype GBM Python** |
| Marché | **Partagé** (mêmes prix pour tous) |
| Client mobile | **Expo + React Native + TypeScript** |
| Backend | NestJS + Prisma + PostgreSQL (+ Redis optionnel) |
| Simulation | Module Python GBM → export JSON/CSV |
| Indépendance | Architecture et UX **spécifiques Stock Market Challenge** |

---

## Phase 1 — ordre d’exécution

1. Prototype Python GBM (séries, corrélations, mean reversion, circuit breakers, export + tests)
2. Scaffold monorepo `simulation/` + `backend/` + `mobile/`
3. API seed titres + tick accéléré + auth JWT
4. Écrans swipe + portfolio + P&L
5. Progression niveaux 1–10 jouable
6. README + tests de stabilité simu
