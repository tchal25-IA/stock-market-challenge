import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TradingService, HOLD_BOT_UNLOCK_LEVEL } from '../trading/trading.service';

@Injectable()
export class BotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trading: TradingService,
  ) {}

  async list(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const unlocked = user.level >= HOLD_BOT_UNLOCK_LEVEL;
    let bot = await this.prisma.bot.findUnique({
      where: { userId_kind: { userId, kind: 'hold' } },
    });
    if (unlocked && !bot) {
      bot = await this.prisma.bot.create({
        data: { userId, kind: 'hold', enabled: false, allocationPct: 20 },
      });
    }
    return {
      unlockLevel: HOLD_BOT_UNLOCK_LEVEL,
      unlocked,
      bots: unlocked && bot
        ? [
            {
              id: bot.id,
              kind: bot.kind,
              name: 'Hold Champion',
              description:
                'Achète des titres stables (faible volatilité) et conserve. Alloue une part de ton cash à chaque tick.',
              enabled: bot.enabled,
              allocationPct: bot.allocationPct,
            },
          ]
        : [],
    };
  }

  async configure(userId: string, kind: string, enabled: boolean, allocationPct?: number) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.level < HOLD_BOT_UNLOCK_LEVEL) {
      throw new BadRequestException(`Bot disponible au niveau ${HOLD_BOT_UNLOCK_LEVEL}`);
    }
    if (kind !== 'hold') throw new BadRequestException('Bot inconnu');
    const pct = allocationPct ?? 20;
    if (pct < 5 || pct > 40) throw new BadRequestException('Allocation entre 5% et 40%');

    const bot = await this.prisma.bot.upsert({
      where: { userId_kind: { userId, kind: 'hold' } },
      create: { userId, kind: 'hold', enabled, allocationPct: pct },
      update: { enabled, allocationPct: pct },
    });
    return { ok: true, bot };
  }

  /** Exécute les bots actifs après un tick marché. */
  async runAllEnabled() {
    const bots = await this.prisma.bot.findMany({ where: { enabled: true } });
    const results: Array<{ userId: string; action: string }> = [];
    for (const bot of bots) {
      if (bot.kind === 'hold') {
        const r = await this.runHold(bot.userId, bot.allocationPct);
        if (r) results.push(r);
      }
    }
    return results;
  }

  private async runHold(userId: string, allocationPct: number) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.level < HOLD_BOT_UNLOCK_LEVEL) return null;
    const budget = user.cash * (allocationPct / 100);
    if (budget < 50) return null;

    const assets = await this.prisma.asset.findMany({
      where: { unlockLevel: { lte: user.level } },
      orderBy: { sigma: 'asc' },
      take: 3,
    });
    if (!assets.length) return null;
    const pick = assets[0];
    const amount = Math.min(budget, user.cash * 0.15, 800);
    if (amount < 25) return null;
    try {
      await this.trading.buy(userId, pick.symbol, Math.floor(amount), {
        source: 'bot:hold',
        skipLevelCheck: true,
      });
      return { userId, action: `hold-buy ${pick.symbol} ${Math.floor(amount)}€` };
    } catch {
      return null;
    }
  }
}
