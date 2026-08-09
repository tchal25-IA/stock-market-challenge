/**
 * Live GBM tick engine (TypeScript port of simulation/gbm.py).
 * Shared market: one step advances all assets together.
 */

import { Injectable } from '@nestjs/common';

export type EngineAsset = {
  id: string;
  symbol: string;
  sector: string;
  price: number;
  mu: number;
  sigma: number;
  anchor: number;
  kappa: number;
};

export type TickResult = {
  prices: Record<string, number>;
  event: { kind: string; detail: string; impact: number } | null;
};

const SECTOR_CORR: Record<string, number> = {
  'tech|tech': 1,
  'tech|consumer': 0.45,
  'tech|energy': 0.15,
  'tech|health': 0.25,
  'tech|finance': 0.35,
  'tech|industrial': 0.4,
  'tech|materials': 0.2,
  'tech|utilities': 0.15,
  'consumer|consumer': 1,
  'consumer|energy': 0.2,
  'consumer|health': 0.3,
  'consumer|finance': 0.4,
  'consumer|industrial': 0.35,
  'consumer|materials': 0.25,
  'consumer|utilities': 0.2,
  'energy|energy': 1,
  'energy|health': 0.1,
  'energy|finance': 0.25,
  'energy|industrial': 0.35,
  'energy|materials': 0.45,
  'energy|utilities': 0.4,
  'health|health': 1,
  'health|finance': 0.3,
  'health|industrial': 0.2,
  'health|materials': 0.15,
  'health|utilities': 0.2,
  'finance|finance': 1,
  'finance|industrial': 0.35,
  'finance|materials': 0.25,
  'finance|utilities': 0.3,
  'industrial|industrial': 1,
  'industrial|materials': 0.5,
  'industrial|utilities': 0.3,
  'materials|materials': 1,
  'materials|utilities': 0.25,
  'utilities|utilities': 1,
};

function corr(a: string, b: string): number {
  if (a === b) return 1;
  const k1 = `${a}|${b}`;
  const k2 = `${b}|${a}`;
  return SECTOR_CORR[k1] ?? SECTOR_CORR[k2] ?? 0.2;
}

function cholesky(m: number[][]): number[][] {
  const n = m.length;
  const L = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = 0;
      for (let k = 0; k < j; k++) s += L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(m[i][i] - s, 1e-12)) : (m[i][j] - s) / L[j][j];
    }
  }
  return L;
}

function gauss(): number {
  // Box-Muller
  const u = Math.max(1e-12, Math.random());
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

@Injectable()
export class GbmEngine {
  private readonly circuitBreakerPct = 0.08;
  private readonly dt = 1;

  step(assets: EngineAsset[]): TickResult {
    const n = assets.length;
    const matrix = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => corr(assets[i].sector, assets[j].sector)),
    );
    const L = cholesky(matrix);
    const z = Array.from({ length: n }, () => gauss());
    const shocks = Array.from({ length: n }, (_, i) => {
      let s = 0;
      for (let j = 0; j <= i; j++) s += L[i][j] * z[j];
      return s;
    });

    let globalMult = 1;
    let event: TickResult['event'] = null;
    const u = Math.random();
    const sectors = [...new Set(assets.map((a) => a.sector))];

    if (u < 0.01) {
      const drop = 0.1 + Math.random() * 0.15;
      globalMult = 1 - drop;
      event = { kind: 'crash', detail: 'Krach marché', impact: -drop };
    } else if (u < 0.03) {
      const boost = 0.05 + Math.random() * 0.1;
      globalMult = 1 + boost;
      event = { kind: 'bull', detail: 'Bull run', impact: boost };
    } else if (u < 0.13) {
      const sector = sectors[Math.floor(Math.random() * sectors.length)];
      const move = (0.03 + Math.random() * 0.05) * (Math.random() > 0.4 ? 1 : -1);
      event = { kind: 'sector_news', detail: `News secteur ${sector}`, impact: move };
    }

    const prices: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const a = assets[i];
      const s = a.price;
      const drift = a.mu + a.kappa * (a.anchor - s) / Math.max(s, 1e-6);
      const dW = shocks[i] * Math.sqrt(this.dt);
      let raw = s * Math.exp((drift - 0.5 * a.sigma ** 2) * this.dt + a.sigma * dW);
      if (event?.kind === 'sector_news' && event.detail.includes(a.sector)) {
        raw *= 1 + event.impact;
      }
      raw *= globalMult;
      const maxUp = s * (1 + this.circuitBreakerPct);
      const maxDn = s * (1 - this.circuitBreakerPct);
      const next = Math.max(0.01, Math.min(Math.max(raw, maxDn), maxUp));
      prices[a.id] = Math.round(next * 10000) / 10000;
    }

    return { prices, event };
  }
}
