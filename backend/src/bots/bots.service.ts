import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TradingService, HOLD_BOT_UNLOCK_LEVEL, SWING_BOT_UNLOCK_LEVEL } from '../trading/trading.service';

@Injectable()
export class BotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trading: TradingService,
  ) {}

  async list(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const holdUnlocked = user.level >= HOLD_BOT_UNLOCK_LEVEL;
    const swingUnlocked = user.level >= SWING_BOT_UNLOCK_LEVEL;
    
    const existingBots = await this.prisma.bot.findMany({
      where: { userId },
    });
    const botMap = new Map(existingBots.map((b) => [b.kind, b]));

    const result: Array<{
      id: string;
      kind: string;
      name: string;
      description: string;
      enabled: boolean;
      allocationPct: number;
      unlockLevel: number;
      unlocked: boolean;
    }> = [];

    // Hold Champion
    if (holdUnlocked) {
      let holdBot = botMap.get('hold');
      if (!holdBot) {
        holdBot = await this.prisma.bot.create({
          data: { userId, kind: 'hold', enabled: false, allocationPct: 20 },
        });
      }
      result.push({
        id: holdBot.id,
        kind: holdBot.kind,
        name: 'Hold Champion',
        description:
          'Achète des titres stables (faible volatilité) et conserve. Alloue une part de ton cash à chaque tick.',
        enabled: holdBot.enabled,
        allocationPct: holdBot.allocationPct,
        unlockLevel: HOLD_BOT_UNLOCK_LEVEL,
        unlocked: true,
      });
    } else {
      result.push({
        id: '',
        kind: 'hold',
        name: 'Hold Champion',
        description: 'Achète des titres stables (faible volatilité) et conserve.',
        enabled: false,
        allocationPct: 20,
        unlockLevel: HOLD_BOT_UNLOCK_LEVEL,
        unlocked: false,
      });
    }

    // Swing Trader
    if (swingUnlocked) {
      let swingBot = botMap.get('swing');
      if (!swingBot) {
        swingBot = await this.prisma.bot.create({
          data: { userId, kind: 'swing', enabled: false, allocationPct: 15 },
        });
      }
      result.push({
        id: swingBot.id,
        kind: swingBot.kind,
        name: 'Swing Trader',
        description:
          'Exploite la volatilité moyenne terme (2-7 ticks). Achète sur baisse, vend sur hausse. Stop loss automatique.',
        enabled: swingBot.enabled,
        allocationPct: swingBot.allocationPct,
        unlockLevel: SWING_BOT_UNLOCK_LEVEL,
        unlocked: true,
      });
    } else {
      result.push({
        id: '',
        kind: 'swing',
        name: 'Swing Trader',
        description: 'Exploite la volatilité moyenne terme. Stratégie de timing.',
        enabled: false,
        allocationPct: 15,
        unlockLevel: SWING_BOT_UNLOCK_LEVEL,
        unlocked: false,
      });
    }

    return { bots: result };
  }

  async configure(userId: string, kind: string, enabled: boolean, allocationPct?: number) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    
    let unlockLevel: number;
    let minPct: number;
    let maxPct: number;
    
    if (kind === 'hold') {
      unlockLevel = HOLD_BOT_UNLOCK_LEVEL;
      minPct = 5;
      maxPct = 40;
    } else if (kind === 'swing') {
      unlockLevel = SWING_BOT_UNLOCK_LEVEL;
      minPct = 5;
      maxPct = 30;
    } else {
      throw new BadRequestException('Bot inconnu');
    }
    
    if (user.level < unlockLevel) {
      throw new BadRequestException(`Bot disponible au niveau ${unlockLevel}`);
    }
    
    const pct = allocationPct ?? (kind === 'hold' ? 20 : 15);
    if (pct < minPct || pct > maxPct) {
      throw new BadRequestException(`Allocation entre ${minPct}% et ${maxPct}%`);
    }

    const bot = await this.prisma.bot.upsert({
      where: { userId_kind: { userId, kind } },
      create: { userId, kind, enabled, allocationPct: pct },
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
      } else if (bot.kind === 'swing') {
        const r = await this.runSwing(bot.userId, bot.allocationPct);
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

  private async runSwing(userId: string, allocationPct: number) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.level < SWING_BOT_UNLOCK_LEVEL) return null;
    
    // Stratégie Swing: cherche les titres avec volatilité moyenne (sigma entre 0.015 et 0.030)
    // et regarde les changements de prix récents pour acheter sur baisse
    const assets = await this.prisma.asset.findMany({
      where: { 
        unlockLevel: { lte: user.level },
        sigma: { gte: 0.015, lte: 0.030 }
      },
      include: {
        ticks: {
          orderBy: { tick: 'desc' },
          take: 5,
        },
      },
    });
    
    if (!assets.length) return null;
    
    // Cherche un titre qui a baissé récemment (opportunité d'achat)
    for (const asset of assets) {
      if (asset.ticks.length < 2) continue;
      const recent = asset.ticks[0].price;
      const previous = asset.ticks[1].price;
      const changePct = (recent - previous) / previous;
      
      // Si baisse de 1% ou plus, opportunité d'achat
      if (changePct <= -0.01) {
        const budget = user.cash * (allocationPct / 100);
        if (budget < 50) continue;
        const amount = Math.min(budget, user.cash * 0.12, 600);
        if (amount < 25) continue;
        
        try {
          await this.trading.buy(userId, asset.symbol, Math.floor(amount), {
            source: 'bot:swing',
            skipLevelCheck: true,
          });
          return { userId, action: `swing-buy ${asset.symbol} ${Math.floor(amount)}€ (baisse ${(changePct * 100).toFixed(1)}%)` };
        } catch {
          continue;
        }
      }
    }
    
    // Vérifie s'il faut vendre (take profit sur hausse de 3%+)
    const holdings = await this.prisma.holding.findMany({
      where: { userId },
      include: { asset: true },
    });
    
    for (const holding of holdings) {
      const gainPct = (holding.asset.currentPrice - holding.avgCost) / holding.avgCost;
      
      // Vend si gain de 3% ou plus
      if (gainPct >= 0.03) {
        try {
          const sellQty = holding.quantity * 0.5; // Vend 50%
          if (sellQty * holding.asset.currentPrice < 25) continue;
          
          await this.trading.sell(userId, holding.asset.symbol, sellQty, {
            source: 'bot:swing',
          });
          return { userId, action: `swing-sell ${holding.asset.symbol} ${Math.floor(sellQty * holding.asset.currentPrice)}€ (gain ${(gainPct * 100).toFixed(1)}%)` };
        } catch {
          continue;
        }
      }
    }
    
    return null;
  }
}
