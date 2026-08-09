import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { GbmEngine } from './gbm.engine';

@Injectable()
export class MarketService implements OnModuleInit {
  private readonly logger = new Logger(MarketService.name);
  private ticking = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gbm: GbmEngine,
  ) {}

  async onModuleInit() {
    const state = await this.prisma.marketState.findUnique({ where: { id: 1 } });
    if (!state) {
      await this.prisma.marketState.create({ data: { id: 1, currentTick: 0 } });
    }
  }

  @Interval(Number(process.env.TICK_INTERVAL_MS ?? 45000))
  async scheduledTick() {
    // Pas de cron long-running sur Vercel serverless
    if (process.env.VERCEL) return;
    try {
      await this.advanceTick();
    } catch (e) {
      this.logger.warn(`Tick failed: ${(e as Error).message}`);
    }
  }

  async listAssets(userLevel = 1) {
    const assets = await this.prisma.asset.findMany({
      where: { unlockLevel: { lte: userLevel } },
      orderBy: { symbol: 'asc' },
    });
    const state = await this.prisma.marketState.findUnique({ where: { id: 1 } });
    return {
      tick: state?.currentTick ?? 0,
      lastEvent: state?.lastEvent ?? null,
      assets: assets.map((a) => ({
        id: a.id,
        symbol: a.symbol,
        name: a.name,
        sector: a.sector,
        price: a.currentPrice,
        unlockLevel: a.unlockLevel,
      })),
    };
  }

  async getAssetDetail(symbol: string) {
    const asset = await this.prisma.asset.findUnique({ where: { symbol: symbol.toUpperCase() } });
    if (!asset) return null;
    const ticks = await this.prisma.priceTick.findMany({
      where: { assetId: asset.id },
      orderBy: { tick: 'asc' },
      take: 96,
    });
    return {
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      sector: asset.sector,
      price: asset.currentPrice,
      history: ticks.map((t) => ({ tick: t.tick, price: t.price, at: t.at })),
      glossary: {
        action: 'Une action = une part de propriété d’une entreprise fictive.',
        pnl: 'P&L = gains ou pertes latents / réalisés sur ton portefeuille.',
        gbm: 'Les prix évoluent via une simulation réaliste (mouvement brownien géométrique).',
      },
    };
  }

  async advanceTick() {
    if (this.ticking) return null;
    this.ticking = true;
    try {
      const assets = await this.prisma.asset.findMany();
      if (!assets.length) return null;

      const step = this.gbm.step(
        assets.map((a) => ({
          id: a.id,
          symbol: a.symbol,
          sector: a.sector,
          price: a.currentPrice,
          mu: a.mu,
          sigma: a.sigma,
          anchor: a.anchor,
          kappa: a.kappa,
        })),
      );

      const state = await this.prisma.marketState.findUniqueOrThrow({ where: { id: 1 } });
      const nextTick = state.currentTick + 1;

      await this.prisma.$transaction(async (tx) => {
        for (const a of assets) {
          const price = step.prices[a.id];
          await tx.asset.update({ where: { id: a.id }, data: { currentPrice: price } });
          await tx.priceTick.create({
            data: { assetId: a.id, price, tick: nextTick },
          });
        }
        await tx.marketState.update({
          where: { id: 1 },
          data: {
            currentTick: nextTick,
            lastEvent: step.event ? `${step.event.kind}: ${step.event.detail}` : null,
            lastEventAt: step.event ? new Date() : state.lastEventAt,
          },
        });
      });

      // Keep history bounded
      const cutoff = nextTick - 200;
      if (cutoff > 0) {
        await this.prisma.priceTick.deleteMany({ where: { tick: { lt: cutoff } } });
      }

      this.logger.debug(`Market tick ${nextTick}${step.event ? ` [${step.event.kind}]` : ''}`);
      return { tick: nextTick, event: step.event };
    } finally {
      this.ticking = false;
    }
  }
}
