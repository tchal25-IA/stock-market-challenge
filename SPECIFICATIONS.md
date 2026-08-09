# 📈 Stock Market Challenge (Portfolio Pro)

**Jeu de trading en bourse fictive avec simulation réaliste et progression par niveaux**

## 🎯 Concept

Un jeu éducatif où les joueurs apprennent le trading sans risque réel. Chacun part avec un portefeuille vide et trade actions, obligations, matières premières et cryptos dans un marché fictif qui évolue de manière réaliste. Progression par niveaux débloques nouvelles fonctionnalités et instruments financiers.

## 📋 Vue d'ensemble

- **Genre:** Simulation financière / Éducation / Stratégie
- **Plateformes:** Mobile-first (iOS/Android) + Web
- **Public cible:** 18-45 ans, intéressés par finance/investissement
- **Modèle économique:** F2P avec premium features (pas de pay-to-win)

## 🎮 Mécaniques Principales

### 1. Core Loop (60-90 secondes)

**Session type:**
1. Ouvrir l'app (5s)
2. Consulter marché et voir évolution portfolio (15s)
3. Analyser 5-10 titres disponibles à son niveau (20s)
4. Acheter/Vendre via swipe (interface Tinder-like) (15s)
5. Voir graphique évolution portfolio (10s)
6. Vérifier si objectif niveau atteint (5s)
7. Collecter récompense si niveau up (10s)

**Pourquoi c'est addictif:**
- Gratification immédiate (voir gains/pertes en temps réel)
- Progression claire (niveaux)
- Feedback visuel satisfaisant (graphiques, animations)
- Sessions courtes mais fréquentes (2-3x/jour)

### 2. Progression par Niveaux (100 niveaux)

**Niveaux 1-10: Débutant - Actions Simples**
- Capital départ: 10,000€ virtuel
- 5 actions "blue chips" stables (Apple-like, Amazon-like)
- Objectif: Atteindre 15,000€ pour level up
- Pas de levier, pas de short
- Tutoriel intégré

**Niveaux 11-20: Intermédiaire - Diversification**
- Déblocage: +5 nouvelles actions (tech)
- Déblocage: Obligations (moins risque, moins rendement)
- Objectif: Portfolio 50,000€
- Première fonctionnalité: Graphiques détaillés

**Niveaux 21-30: Avancé - Matières Premières**
- Déblocage: Or, Pétrole, Blé, Cuivre
- Déblocage: Effet de levier x2 (gains/pertes doublés)
- Objectif: 150,000€
- Fonctionnalité: Alertes prix

**Niveaux 31-40: Expert - Cryptos & Bots**
- Déblocage: 3 cryptomonnaies (Bitcoin-like, Ethereum-like, Altcoin)
- Déblocage: 1er Bot de trading (automatise 1 stratégie simple)
- Objectif: 500,000€
- Fonctionnalité: Analyse technique (RSI, MACD)

**Niveaux 41-50: Pro - ETF & Levier x5**
- Déblocage: ETF sectoriels (Tech, Energy, Finance)
- Déblocage: Levier x5
- Déblocage: 2e Bot de trading
- Objectif: 2,000,000€
- Fonctionnalité: Copy trading (copier top players)

**Niveaux 51-75: Master - Options & Futures**
- Déblocage: Options (calls/puts)
- Déblocage: Futures sur indices
- Déblocage: 3 bots simultanés
- Objectif: 10,000,000€
- Fonctionnalité: Portefeuilles multiples

**Niveaux 76-100: Legend - Trading Avancé**
- Déblocage: Tous instruments
- Déblocage: 5 bots + stratégies custom
- Déblocage: Alertes ultra-personnalisées
- Objectif: 100,000,000€
- Fonctionnalité: Mode "Fund Manager" (gérer argent d'autres joueurs)

### 3. Marché Fictif - Simulation Réaliste

**Évolution des prix:**
- Toutes les heures (24/7)
- Algorithme Geometric Brownian Motion (GBM) pour réalisme
- Corrélations sectorielles (si tech ↑, souvent GAFA ↑)
- Mean reversion (prix reviennent vers moyenne long terme)

**Événements de marché:**
- **Bull Run** (rare, 2%): Tous les titres montent 5-15%
- **Crash** (rare, 1%): Tous les titres baissent 10-25%
- **News sectorielles** (fréquent, 10%): Un secteur impacté
- **Black Swan** (très rare, 0.1%): Krach majeur (-40%)

**Données affichées:**
- Prix actuel
- Variation 1h, 24h, 7j, 30j
- Graphique chandelier (pro) ou ligne (débutant)
- Volume de trades
- Market cap

### 4. Interface Ultra-Simple (Mobile-First)

**Écran Principal: Vue Marché**
```
┌─────────────────────────────────┐
│  Portfolio: 45,250€ (+5.2%)    │
│  Niveau 23 - Avancé            │
├─────────────────────────────────┤
│  ⭐ Actions Disponibles (10)   │
│                                 │
│  🟢 TechCorp +2.3%    125€     │
│  [Swipe → pour ACHETER]        │
│  [Swipe ← pour IGNORER]        │
│                                 │
│  🔴 EnergyInc -1.5%   78€      │
│  [Swipe → pour ACHETER]        │
│                                 │
│  ...8 autres titres...         │
├─────────────────────────────────┤
│  📊 Portfolio | 🏆 Classements │
└─────────────────────────────────┘
```

**Interaction Swipe:**
- Swipe droite → Acheter (modal montant)
- Swipe gauche → Ignorer
- Tap sur titre → Voir détails (graphique, infos)

### 5. Système de Bots (Automatisation)

**Bot 1 - "Hold Champion" (Niveau 31):**
- Achète titres stables et hold long terme
- Vend seulement si baisse >20%
- Gère max 30% du portfolio

**Bot 2 - "Day Trader" (Niveau 41):**
- Achète/vend plusieurs fois par jour
- Suit tendances court terme
- Gère max 20% du portfolio
- Plus risqué mais potentiel gains rapides

**Bot 3 - "Value Investor" (Niveau 51):**
- Cherche titres sous-évalués
- Hold jusqu'à objectif prix atteint
- Gère max 40% du portfolio
- Stratégie Warren Buffett-like

**Bot 4 - "Swing Trader" (Niveau 61):**
- Exploite volatilité moyenne terme (2-7 jours)
- Stop loss automatique
- Gère max 25% du portfolio

**Bot 5 - "Momentum" (Niveau 71):**
- Suit tendances fortes
- Entre après confirmation, sort rapidement
- Gère max 30% du portfolio

**Configuration:**
- Le joueur active/désactive chaque bot
- Définit % du portfolio alloué
- Les bots ne peuvent pas tout perdre (stop loss global)

### 6. Challenges & Événements

**Challenges Hebdomadaires:**
- "Gagne +15% cette semaine" → Récompense: 100 gems
- "Diversifie sur 5 secteurs différents" → Récompense: Pack ETF
- "Utilise tes 3 jokers" → Récompense: 1 bot gratuit 48h
- "Trade 20 fois" → Récompense: XP bonus

**Événements Mensuels:**
- "Bear Market Survival": Marché crash, qui perd le moins?
- "Bull Run Race": Marché explose, qui gagne le plus?
- "Volatility King": Marché chaotique, meilleur trader gagne

**Saisons (3 mois):**
- Reset des portfolios (tout le monde repart à 0)
- Classement saisonnier
- Récompenses permanentes pour top 1000:
  - Badges exclusifs
  - Skins portfolio
  - 1 bot premium permanent
- Progressio niveaux conservée (pas de reset)

### 7. Fonctionnalités Sociales

**Classements:**
- Local (Top 20 proches géographiquement)
- Amis (Top tous les amis)
- Global (Top 100 mondiaux)
- Hebdomadaire, Mensuel, Saisonnier, All-Time

**Copy Trading (Niveau 41+):**
- Voir portfolios des top 10 joueurs
- Copier leurs trades (délai 15 min pour équité)
- Coût: 5% des gains réalisés via copy
- Limite: Max 30% du portfolio en copy trading

**Clubs d'Investissement (Niveau 25+):**
- 20-50 membres
- Chat intégré
- Partage d'analyses
- Compétition clubs (quel club gagne le plus collectivement)
- Bonus: +5% XP pour membres

### 8. Aspect Éducatif

**Glossaire intégré:**
- Définitions simples de termes financiers
- Animations explicatives
- Quiz avec récompenses

**Tutoriels progressifs:**
- Niveau 1: C'est quoi une action?
- Niveau 11: Obligations vs Actions
- Niveau 21: Matières premières
- Niveau 31: Cryptos et volatilité
- Niveau 41: ETF et diversification
- Niveau 51: Options (calls/puts)

**Académie (optionnelle):**
- Cours vidéo 2-5 min
- Sujets: Analyse technique, diversification, risk management
- Compléter cours → Gems bonus

### 9. Monétisation Éthique

**Gratuit (Fully Playable):**
- Tous niveaux accessibles
- Tous instruments financiers accessibles gratuitement
- 1 bot permanent gratuit (choix libre)
- Progression: 4-6 mois pour niveau 100

**Premium (IAP):**
- **Battle Pass** (9.99€/mois):
  - 2 bots supplémentaires actifs simultanément
  - Alertes push illimitées
  - Accès early nouveaux titres (24h avant F2P)
  - Skins exclusifs
- **Gems** (IAP 0.99€-9.99€):
  - Accélérer progression XP (max x2)
  - Débloquer bots temporairement (48h)
  - Cosmétiques (skins, animations)

**Pas de Pay-to-Win:**
- Impossible d'acheter de l'argent in-game directement
- Les meilleurs traders sont skill-based
- Premium = convenience, pas power

### 10. Métriques de Succès

**Rétention:**
- D1: >50% (session courte, gratifiant)
- D7: >30% (hooks quotidiens forts)
- D30: >15% (progression long terme)

**Engagement:**
- Sessions/jour: 2-4
- Session length: 3-5 minutes
- DAU/MAU: >30%

**Monétisation:**
- ARPU: $1.20-2.00
- Conversion: 5-8%
- LTV 12 mois: $20-35

**Viralité:**
- K-factor: 0.4-0.6 (partages résultats, défis amis)
- Organic: 50% après 6 mois

## 💰 Budget Prévisionnel

**Phase 1 - MVP (4-5 mois):** 350K€
- Équipe: 7.5 FTE
- Infra: 3K€/mois
- Marketing beta: 15K€

**Année 1:** 2.8M€
- Dev + Post-MVP: 1.5M€
- User Acquisition: 1M€
- Ops: 300K€

## 🛠️ Stack Technique

- **Mobile:** React Native / Swift+Kotlin natif (performance)
- **Backend:** Node.js, PostgreSQL, TimescaleDB (time-series data)
- **Simulation:** Python (algorithmes GBM, corrélations)
- **Realtime:** WebSockets
- **Cache:** Redis
- **Infra:** AWS/GCP, Kubernetes

## 🚀 Prochaines Étapes

1. MVP avec niveaux 1-30 (4 mois)
2. Beta fermée 500 joueurs (8 semaines)
3. Lancement soft 1 pays (4 semaines)
4. Lancement global
5. Itérations continues basées data

## 📞 Contact

**Repository GitHub:** https://github.com/VOTRE-USERNAME/stock-market-challenge

---

**Créé le:** 8 août 2026  
**Version:** 1.0.0-alpha
