import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const FALLBACK_ASSETS = [
  { symbol: 'TECH', name: 'TechNova SA', sector: 'tech', price0: 120, mu: 0.00012, sigma: 0.018, anchor: 125, kappa: 0.06 },
  { symbol: 'RETL', name: 'RetailMax SE', sector: 'consumer', price0: 85, mu: 0.00008, sigma: 0.014, anchor: 88, kappa: 0.07 },
  { symbol: 'ENRG', name: 'Energia Corp', sector: 'energy', price0: 64, mu: 0.00005, sigma: 0.022, anchor: 70, kappa: 0.05 },
  { symbol: 'HLTH', name: 'MediLife AG', sector: 'health', price0: 95, mu: 0.0001, sigma: 0.012, anchor: 98, kappa: 0.08 },
  { symbol: 'BANK', name: 'SolidBank Group', sector: 'finance', price0: 48, mu: 0.00006, sigma: 0.016, anchor: 50, kappa: 0.07 },
];

async function main() {
  const marketJson = path.resolve(__dirname, '../../simulation/out/market.json');
  let assets = FALLBACK_ASSETS;
  let series: Record<string, number[]> | null = null;

  if (fs.existsSync(marketJson)) {
    const raw = JSON.parse(fs.readFileSync(marketJson, 'utf-8')) as {
      assets: typeof FALLBACK_ASSETS;
      series: Record<string, number[]>;
    };
    assets = raw.assets.map((a) => ({
      symbol: a.symbol,
      name: a.name,
      sector: a.sector,
      price0: a.price0,
      mu: a.mu,
      sigma: a.sigma,
      anchor: a.anchor,
      kappa: a.kappa ?? 0.08,
    }));
    series = raw.series;
  }

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
        kappa: a.kappa,
        currentPrice: a.price0,
        unlockLevel: 1,
      },
    });

    const prices = series?.[a.symbol] ?? [a.price0];
    // Seed last 48 ticks for charts (or all if shorter)
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

  const lastTick = series
    ? Math.max(...Object.values(series).map((s) => s.length - 1))
    : 0;

  await prisma.marketState.create({
    data: { id: 1, currentTick: lastTick },
  });

  console.log(`Seeded ${assets.length} assets, market tick=${lastTick}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
