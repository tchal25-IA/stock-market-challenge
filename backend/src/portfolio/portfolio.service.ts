import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Levels 1–10: same 5 stocks; target portfolio value 15k€ to clear. */
export const LEVEL_TARGET = 15000;
export const MAX_LEVEL_PHASE1 = 10;

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
    const targetReached = totalValue >= LEVEL_TARGET;
    const canLevelUp = targetReached && user.level < MAX_LEVEL_PHASE1;

    return {
      cash: user.cash,
      holdingsValue,
      totalValue,
      totalPnl,
      totalPnlPct,
      level: user.level,
      target: LEVEL_TARGET,
      targetReached,
      canLevelUp,
      maxLevel: MAX_LEVEL_PHASE1,
      tutorialDone: user.tutorialDone,
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
    return { ok: true, level: user.level, portfolio: await this.getPortfolio(userId) };
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
