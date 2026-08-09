import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { ASSET_CATALOG } from '../src/market/assets.catalog';

const prisma = new PrismaClient();

type SeedAsset = {
  symbol: string;
  name: string;
  sector: string;
  price0: number;
  mu: number;
  sigma: number;
  anchor: number;
  kappa: number;
  unlockLevel: number;
};

function loadMarket(): { assets: SeedAsset[]; series: Record<string, number[]> | null } {
  const candidates = [
    path.resolve(__dirname, 'seed-market.json'),
    path.resolve(__dirname, '../../simulation/out/market.json'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
      assets: Array<SeedAsset & { unlock_level?: number }>;
      series: Record<string, number[]>;
    };
    const bySymbol = new Map(ASSET_CATALOG.map((a) => [a.symbol, a]));
    return {
      assets: raw.assets.map((a) => {
        const cat = bySymbol.get(a.symbol);
        return {
          symbol: a.symbol,
          name: a.name,
          sector: a.sector,
          price0: a.price0,
          mu: a.mu,
          sigma: a.sigma,
          anchor: a.anchor,
          kappa: a.kappa ?? 0.08,
          unlockLevel: a.unlockLevel ?? a.unlock_level ?? cat?.unlockLevel ?? 1,
        };
      }),
      series: raw.series,
    };
  }
  return {
    assets: ASSET_CATALOG.map((a) => ({
      symbol: a.symbol,
      name: a.name,
      sector: a.sector,
      price0: a.price0,
      mu: a.mu,
      sigma: a.sigma,
      anchor: a.anchor,
      kappa: a.kappa,
      unlockLevel: a.unlockLevel,
    })),
    series: null,
  };
}

async function main() {
  const { assets, series } = loadMarket();

  await prisma.trade.deleteMany();
  await prisma.holding.deleteMany();
  await prisma.priceTick.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.marketState.deleteMany();

  for (const a of assets) {
    const created = await prisma.asset.create({
      data: {
        symbol: a.symbol,
        name: a.name,
        sector: a.sector,
        price0: a.price0,
        mu: a.mu,
        sigma: a.sigma,
        anchor: a.anchor,
        kappa: a.kappa ?? 0.08,
        currentPrice: a.price0,
        unlockLevel: a.unlockLevel,
      },
    });

    const prices = series?.[a.symbol] ?? [a.price0];
    const slice = prices.slice(-48);
    const startTick = Math.max(0, prices.length - slice.length);
    await prisma.priceTick.createMany({
      data: slice.map((price, i) => ({
        assetId: created.id,
        price,
        tick: startTick + i,
      })),
    });
    await prisma.asset.update({
      where: { id: created.id },
      data: { currentPrice: slice[slice.length - 1] },
    });
  }

  // Ajoute les titres du catalogue absents du JSON de simu
  for (const cat of ASSET_CATALOG) {
    const exists = await prisma.asset.findUnique({ where: { symbol: cat.symbol } });
    if (exists) continue;
    const created = await prisma.asset.create({
      data: {
        symbol: cat.symbol,
        name: cat.name,
        sector: cat.sector,
        price0: cat.price0,
        mu: cat.mu,
        sigma: cat.sigma,
        anchor: cat.anchor,
        kappa: cat.kappa,
        currentPrice: cat.price0,
        unlockLevel: cat.unlockLevel,
      },
    });
    await prisma.priceTick.create({
      data: { assetId: created.id, price: cat.price0, tick: 0 },
    });
  }

  const lastTick = series
    ? Math.max(...Object.values(series).map((s) => s.length - 1))
    : 0;

  await prisma.marketState.create({
    data: { id: 1, currentTick: lastTick },
  });

  const count = await prisma.asset.count();
  console.log(`Seeded ${count} assets, market tick=${lastTick}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
