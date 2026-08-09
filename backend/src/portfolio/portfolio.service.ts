import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ASSET_CATALOG } from '../market/assets.catalog';

export const MAX_LEVEL_PHASE1 = 10;

/** Objectif de valeur portefeuille pour passer le niveau courant. */
export function targetForLevel(level: number): number {
  return 10000 + level * 5000;
}

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
      return {
        assetId: h.assetId,
        symbol: h.asset.symbol,
        name: h.asset.name,
        sector: h.asset.sector,
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
    const canLevelUp = targetReached && user.level < MAX_LEVEL_PHASE1;
    const nextUnlocks = ASSET_CATALOG.filter((a) => a.unlockLevel === user.level + 1).map((a) => ({
      symbol: a.symbol,
      name: a.name,
      unlockLevel: a.unlockLevel,
    }));
    const unlockedSymbols = ASSET_CATALOG.filter((a) => a.unlockLevel <= user.level).map((a) => a.symbol);

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
      maxLevel: MAX_LEVEL_PHASE1,
      progressPct: Math.min(100, (totalValue / target) * 100),
      tutorialDone: user.tutorialDone,
      nextUnlocks,
      unlockedCount: unlockedSymbols.length,
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
      return { ok: false, reason: 'Objectif non atteint ou niveau max Phase 1', portfolio };
    }
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { level: { increment: 1 } },
    });
    const unlocked = ASSET_CATALOG.filter((a) => a.unlockLevel === user.level).map((a) => ({
      symbol: a.symbol,
      name: a.name,
    }));
    return {
      ok: true,
      level: user.level,
      unlocked,
      portfolio: await this.getPortfolio(userId),
    };
  }

  async history(userId: string) {
    return this.prisma.trade.findMany({
      where: { userId },
      include: { asset: { select: { symbol: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
