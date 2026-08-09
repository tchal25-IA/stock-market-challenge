import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { GbmEngine } from './gbm.engine';
import { ASSET_CATALOG, blurbFor, kindFor, KIND_LABEL } from './assets.catalog';
import { BotsService } from '../bots/bots.service';

@Injectable()
export class MarketService implements OnModuleInit {
  private readonly logger = new Logger(MarketService.name);
  private ticking = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gbm: GbmEngine,
    @Inject(forwardRef(() => BotsService)) private readonly bots: BotsService,
  ) {}

  async onModuleInit() {
    await this.ensureMarketState();
    await this.ensureCatalogAssets();
  }

  private async ensureMarketState() {
    const state = await this.prisma.marketState.findUnique({ where: { id: 1 } });
    if (!state) {
      await this.prisma.marketState.create({ data: { id: 1, currentTick: 0 } });
    }
  }

  private async ensureCatalogAssets() {
    for (const a of ASSET_CATALOG) {
      const existing = await this.prisma.asset.findUnique({ where: { symbol: a.symbol } });
      if (existing) {
        await this.prisma.asset.update({
          where: { id: existing.id },
          data: {
            name: a.name,
            sector: a.sector,
            kind: a.kind,
            unlockLevel: a.unlockLevel,
            mu: a.mu,
            sigma: a.sigma,
            anchor: a.anchor,
            kappa: a.kappa,
          },
        });
        continue;
      }
      const created = await this.prisma.asset.create({
        data: {
          symbol: a.symbol,
          name: a.name,
          sector: a.sector,
          kind: a.kind,
          price0: a.price0,
          mu: a.mu,
          sigma: a.sigma,
          anchor: a.anchor,
          kappa: a.kappa,
          currentPrice: a.price0,
          unlockLevel: a.unlockLevel,
        },
      });
      await this.prisma.priceTick.create({
        data: { assetId: created.id, price: a.price0, tick: 0 },
      });
      this.logger.log(`Asset ajouté: ${a.symbol}`);
    }
  }

  @Interval(Number(process.env.TICK_INTERVAL_MS ?? 45000))
  async scheduledTick() {
    if (process.env.VERCEL) return;
    try {
      await this.advanceTick();
    } catch (e) {
      this.logger.warn(`Tick failed: ${(e as Error).message}`);
    }
  }

  async maybeAdvance() {
    const interval = Number(process.env.TICK_INTERVAL_MS ?? 45000);
    const state = await this.prisma.marketState.findUnique({ where: { id: 1 } });
    if (!state) return null;
    const elapsed = Date.now() - new Date(state.updatedAt).getTime();
    if (elapsed >= interval) {
      return this.advanceTick();
    }
    return null;
  }

  async listAssets(userLevel = 1) {
    await this.maybeAdvance();
    const assets = await this.prisma.asset.findMany({
      orderBy: [{ unlockLevel: 'asc' }, { symbol: 'asc' }],
    });
    const state = await this.prisma.marketState.findUnique({ where: { id: 1 } });
    const unlocked = assets.filter((a) => a.unlockLevel <= userLevel);
    const locked = assets
      .filter((a) => a.unlockLevel > userLevel)
      .map((a) => ({
        symbol: a.symbol,
        name: a.name,
        sector: a.sector,
        kind: a.kind,
        kindLabel: KIND_LABEL[kindFor(a.symbol)],
        unlockLevel: a.unlockLevel,
      }));

    const withChange = await Promise.all(
      unlocked.map(async (a) => {
        const recent = await this.prisma.priceTick.findMany({
          where: { assetId: a.id },
          orderBy: { tick: 'desc' },
          take: 25,
        });
        const newest = recent[0]?.price ?? a.currentPrice;
        const prev = recent[1]?.price ?? newest;
        const dayRef = recent[Math.min(23, recent.length - 1)]?.price ?? newest;
        const spark = [...recent].reverse().map((t) => t.price);
        const kind = (a.kind as 'stock' | 'bond' | 'commodity') || kindFor(a.symbol);
        return {
          id: a.id,
          symbol: a.symbol,
          name: a.name,
          sector: a.sector,
          kind,
          kindLabel: KIND_LABEL[kind],
          price: a.currentPrice,
          unlockLevel: a.unlockLevel,
          blurb: blurbFor(a.symbol),
          changePct: prev > 0 ? ((newest - prev) / prev) * 100 : 0,
          changePctDay: dayRef > 0 ? ((newest - dayRef) / dayRef) * 100 : 0,
          sparkline: spark.slice(-16),
        };
      }),
    );

    return {
      tick: state?.currentTick ?? 0,
      lastEvent: state?.lastEvent ?? null,
      assets: withChange,
      locked,
      unlockedCount: unlocked.length,
      totalCount: assets.length,
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
    const history = ticks.map((t) => ({ tick: t.tick, price: t.price, at: t.at }));
    const first = history[0]?.price ?? asset.currentPrice;
    const last = history[history.length - 1]?.price ?? asset.currentPrice;
    const prev = history.length > 1 ? history[history.length - 2].price : last;
    const kind = (asset.kind as 'stock' | 'bond' | 'commodity') || kindFor(asset.symbol);
    return {
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      sector: asset.sector,
      kind,
      kindLabel: KIND_LABEL[kind],
      price: asset.currentPrice,
      unlockLevel: asset.unlockLevel,
      blurb: blurbFor(asset.symbol),
      changePct: prev > 0 ? ((last - prev) / prev) * 100 : 0,
      changePctRange: first > 0 ? ((last - first) / first) * 100 : 0,
      history,
      glossary: {
        action: 'Une action = une part de propriété d’une entreprise fictive.',
        obligation: 'Une obligation = un prêt à un émetteur ; plus stable, moins de rendement.',
        matiere: 'Une matière première = or, pétrole, blé… sensible aux chocs macro.',
        pnl: 'P&L = gains ou pertes latents / réalisés sur ton portefeuille.',
        gbm: 'Les prix évoluent via une simulation réaliste (mouvement brownien géométrique).',
        secteur: `Secteur ${asset.sector} — les titres proches bougent souvent ensemble.`,
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

      const cutoff = nextTick - 200;
      if (cutoff > 0) {
        await this.prisma.priceTick.deleteMany({ where: { tick: { lt: cutoff } } });
      }

      try {
        await this.bots.runAllEnabled();
      } catch (e) {
        this.logger.warn(`Bots tick failed: ${(e as Error).message}`);
      }

      this.logger.debug(`Market tick ${nextTick}${step.event ? ` [${step.event.kind}]` : ''}`);
      return { tick: nextTick, event: step.event };
    } finally {
      this.ticking = false;
    }
  }
}
