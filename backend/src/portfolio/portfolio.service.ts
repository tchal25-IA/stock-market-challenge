import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ASSET_CATALOG, KIND_LABEL, kindFor } from '../market/assets.catalog';
import { HOLD_BOT_UNLOCK_LEVEL } from '../trading/trading.service';

export const MAX_LEVEL_PHASE11 = 20;

/** Objectif de valeur portefeuille pour passer le niveau courant. */
export function targetForLevel(level: number): number {
  if (level <= 10) return 10000 + level * 5000;
  // Phase 1.1 : objectifs plus ambitieux
  return 60000 + (level - 10) * 15000;
}

const EDUCATION: Record<number, string> = {
  1: 'Une action = une part d’entreprise. Diversifie dès le départ.',
  5: 'La volatilité mesure l’ampleur des variations de prix.',
  10: 'Bravo Phase 1 — les obligations arrivent au niveau 11.',
  11: 'Les obligations sont en général plus stables que les actions.',
  15: 'Les matières premières réagissent fort aux chocs macro.',
  20: 'Tu maîtrises le trio actions / obligations / matières.',
};

@Injectable()
export class PortfolioService {
  constructor(private readonly prisma: PrismaService) {}

  async getPortfolio(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const holdings = await this.prisma.holding.findMany({
      where: { userId },
      include: { asset: true },
    });

    const positions = holdings.map((h) => {
      const marketValue = h.quantity * h.asset.currentPrice;
      const cost = h.quantity * h.avgCost;
      const pnl = marketValue - cost;
      const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
      const kind = (h.asset.kind as 'stock' | 'bond' | 'commodity') || kindFor(h.asset.symbol);
      return {
        assetId: h.assetId,
        symbol: h.asset.symbol,
        name: h.asset.name,
        sector: h.asset.sector,
        kind,
        kindLabel: KIND_LABEL[kind],
        quantity: h.quantity,
        avgCost: h.avgCost,
        price: h.asset.currentPrice,
        marketValue,
        pnl,
        pnlPct,
      };
    });

    const holdingsValue = positions.reduce((s, p) => s + p.marketValue, 0);
    const totalValue = user.cash + holdingsValue;
    const totalPnl = totalValue - 10000;
    const totalPnlPct = (totalPnl / 10000) * 100;
    const target = targetForLevel(user.level);
    const targetReached = totalValue >= target;
    const canLevelUp = targetReached && user.level < MAX_LEVEL_PHASE11;
    const nextUnlocks = ASSET_CATALOG.filter((a) => a.unlockLevel === user.level + 1).map((a) => ({
      symbol: a.symbol,
      name: a.name,
      kind: a.kind,
      unlockLevel: a.unlockLevel,
    }));
    const unlockedSymbols = ASSET_CATALOG.filter((a) => a.unlockLevel <= user.level).map((a) => a.symbol);
    const tip =
      EDUCATION[user.level] ??
      (user.level < 11
        ? 'Atteins l’objectif pour débloquer de nouveaux titres.'
        : 'Équilibre actions / obligations / matières pour lisser le risque.');

    const byKind = {
      stock: positions.filter((p) => p.kind === 'stock').reduce((s, p) => s + p.marketValue, 0),
      bond: positions.filter((p) => p.kind === 'bond').reduce((s, p) => s + p.marketValue, 0),
      commodity: positions.filter((p) => p.kind === 'commodity').reduce((s, p) => s + p.marketValue, 0),
    };

    return {
      cash: user.cash,
      holdingsValue,
      totalValue,
      totalPnl,
      totalPnlPct,
      level: user.level,
      target,
      targetReached,
      canLevelUp,
      maxLevel: MAX_LEVEL_PHASE11,
      progressPct: Math.min(100, (totalValue / target) * 100),
      tutorialDone: user.tutorialDone,
      nextUnlocks,
      unlockedCount: unlockedSymbols.length,
      botUnlockLevel: HOLD_BOT_UNLOCK_LEVEL,
      educationTip: tip,
      allocation: byKind,
      isGuest: user.isGuest,
      username: user.username,
      email: user.email,
      positions,
    };
  }

  async completeTutorial(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tutorialDone: true },
    });
    return { ok: true };
  }

  async levelUp(userId: string) {
    const portfolio = await this.getPortfolio(userId);
    if (!portfolio.canLevelUp) {
      return { ok: false, reason: 'Objectif non atteint ou niveau max Phase 1.1', portfolio };
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { level: { increment: 1 } },
    });
    const unlocked = ASSET_CATALOG.filter((a) => a.unlockLevel === user.level).map((a) => ({
      symbol: a.symbol,
      name: a.name,
      kind: a.kind,
    }));
    return {
      ok: true,
      level: user.level,
      unlocked,
      educationTip: EDUCATION[user.level] ?? null,
      portfolio: await this.getPortfolio(userId),
    };
  }

  async history(userId: string) {
    return this.prisma.trade.findMany({
      where: { userId },
      include: { asset: { select: { symbol: true, name: true, kind: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
