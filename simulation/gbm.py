"""
Stock Market Challenge — Geometric Brownian Motion market simulator.

Features:
- Multi-asset GBM with sector correlation (Cholesky)
- Mean reversion toward long-term anchors
- Circuit breakers (±max move per tick)
- Rare events: bull run / crash / sector news
- Export JSON / CSV
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import random
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class AssetSpec:
    symbol: str
    name: str
    sector: str
    price0: float
    mu: float  # drift
    sigma: float  # volatility
    anchor: float  # mean-reversion target
    kappa: float = 0.08  # mean-reversion strength
    unlock_level: int = 1


DEFAULT_ASSETS: list[AssetSpec] = [
    AssetSpec("TECH", "TechNova SA", "tech", 120.0, 0.00012, 0.018, 125.0, 0.06, 1),
    AssetSpec("RETL", "RetailMax SE", "consumer", 85.0, 0.00008, 0.014, 88.0, 0.07, 1),
    AssetSpec("ENRG", "Energia Corp", "energy", 64.0, 0.00005, 0.022, 70.0, 0.05, 1),
    AssetSpec("HLTH", "MediLife AG", "health", 95.0, 0.00010, 0.012, 98.0, 0.08, 1),
    AssetSpec("BANK", "SolidBank Group", "finance", 48.0, 0.00006, 0.016, 50.0, 0.07, 1),
    AssetSpec("CLOUD", "CloudPeak Systems", "tech", 142.0, 0.00014, 0.020, 150.0, 0.05, 1),
    AssetSpec("FOOD", "FreshBite Foods", "consumer", 36.0, 0.00007, 0.013, 38.0, 0.08, 1),
    AssetSpec("CHIP", "SemiCore NV", "tech", 210.0, 0.00015, 0.024, 220.0, 0.045, 1),
    AssetSpec("AUTO", "AutoDrive Motors", "industrial", 78.0, 0.00009, 0.019, 82.0, 0.06, 2),
    AssetSpec("MINE", "OreForge Mining", "materials", 52.0, 0.00004, 0.026, 55.0, 0.04, 3),
    AssetSpec("MEDIA", "StreamWave Media", "consumer", 29.0, 0.00011, 0.021, 32.0, 0.055, 4),
    AssetSpec("UTIL", "GridPower Utilities", "utilities", 41.0, 0.00003, 0.010, 42.0, 0.09, 5),
    AssetSpec("AIR", "SkyLink Airways", "industrial", 67.0, 0.00008, 0.023, 70.0, 0.05, 6),
    AssetSpec("PAY", "PayNova Fintech", "finance", 88.0, 0.00013, 0.020, 92.0, 0.055, 7),
    AssetSpec("LUXE", "Maison Luxe", "consumer", 310.0, 0.00010, 0.015, 320.0, 0.07, 8),
]

# Pairwise sector correlation (symmetric). Diagonal = 1.
SECTOR_CORR = {
    ("tech", "tech"): 1.0,
    ("tech", "consumer"): 0.45,
    ("tech", "energy"): 0.15,
    ("tech", "health"): 0.25,
    ("tech", "finance"): 0.35,
    ("tech", "industrial"): 0.4,
    ("tech", "materials"): 0.2,
    ("tech", "utilities"): 0.15,
    ("consumer", "consumer"): 1.0,
    ("consumer", "energy"): 0.20,
    ("consumer", "health"): 0.30,
    ("consumer", "finance"): 0.40,
    ("consumer", "industrial"): 0.35,
    ("consumer", "materials"): 0.25,
    ("consumer", "utilities"): 0.2,
    ("energy", "energy"): 1.0,
    ("energy", "health"): 0.10,
    ("energy", "finance"): 0.25,
    ("energy", "industrial"): 0.35,
    ("energy", "materials"): 0.45,
    ("energy", "utilities"): 0.4,
    ("health", "health"): 1.0,
    ("health", "finance"): 0.30,
    ("health", "industrial"): 0.2,
    ("health", "materials"): 0.15,
    ("health", "utilities"): 0.2,
    ("finance", "finance"): 1.0,
    ("finance", "industrial"): 0.35,
    ("finance", "materials"): 0.25,
    ("finance", "utilities"): 0.3,
    ("industrial", "industrial"): 1.0,
    ("industrial", "materials"): 0.5,
    ("industrial", "utilities"): 0.3,
    ("materials", "materials"): 1.0,
    ("materials", "utilities"): 0.25,
    ("utilities", "utilities"): 1.0,
}


@dataclass
class SimConfig:
    n_ticks: int = 500
    seed: int = 42
    dt: float = 1.0  # 1 tick = 1 market hour
    circuit_breaker_pct: float = 0.08  # max ±8% per tick
    bull_prob: float = 0.02
    crash_prob: float = 0.01
    sector_news_prob: float = 0.10
    bull_boost: tuple[float, float] = (0.05, 0.15)
    crash_drop: tuple[float, float] = (0.10, 0.25)
    sector_move: tuple[float, float] = (0.03, 0.08)


@dataclass
class TickEvent:
    tick: int
    kind: str
    detail: str
    impact: float


@dataclass
class SimulationResult:
    assets: list[dict[str, Any]]
    series: dict[str, list[float]]
    events: list[dict[str, Any]]
    meta: dict[str, Any] = field(default_factory=dict)


def _corr_matrix(assets: list[AssetSpec]) -> list[list[float]]:
    n = len(assets)
    m = [[0.0] * n for _ in range(n)]
    for i, a in enumerate(assets):
        for j, b in enumerate(assets):
            key = (a.sector, b.sector) if (a.sector, b.sector) in SECTOR_CORR else (b.sector, a.sector)
            m[i][j] = SECTOR_CORR.get(key, 0.2 if i != j else 1.0)
            if i == j:
                m[i][j] = 1.0
    return m


def _cholesky(matrix: list[list[float]]) -> list[list[float]]:
    n = len(matrix)
    L = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1):
            s = sum(L[i][k] * L[j][k] for k in range(j))
            if i == j:
                val = matrix[i][i] - s
                if val <= 1e-12:
                    val = 1e-12
                L[i][j] = math.sqrt(val)
            else:
                L[i][j] = (matrix[i][j] - s) / L[j][j]
    return L


def _correlated_normals(L: list[list[float]], rng: random.Random) -> list[float]:
    n = len(L)
    z = [rng.gauss(0.0, 1.0) for _ in range(n)]
    return [sum(L[i][j] * z[j] for j in range(i + 1)) for i in range(n)]


def simulate(
    assets: list[AssetSpec] | None = None,
    config: SimConfig | None = None,
) -> SimulationResult:
    assets = assets or list(DEFAULT_ASSETS)
    config = config or SimConfig()
    rng = random.Random(config.seed)
    L = _cholesky(_corr_matrix(assets))

    prices = [a.price0 for a in assets]
    series: dict[str, list[float]] = {a.symbol: [a.price0] for a in assets}
    events: list[TickEvent] = []
    sectors = sorted({a.sector for a in assets})

    for t in range(1, config.n_ticks + 1):
        shocks = _correlated_normals(L, rng)
        global_mult = 1.0
        event: TickEvent | None = None

        u = rng.random()
        if u < config.crash_prob:
            drop = rng.uniform(*config.crash_drop)
            global_mult = 1.0 - drop
            event = TickEvent(t, "crash", "Krach marché", -drop)
        elif u < config.crash_prob + config.bull_prob:
            boost = rng.uniform(*config.bull_boost)
            global_mult = 1.0 + boost
            event = TickEvent(t, "bull", "Bull run", boost)
        elif u < config.crash_prob + config.bull_prob + config.sector_news_prob:
            sector = rng.choice(sectors)
            move = rng.uniform(*config.sector_move) * (1 if rng.random() > 0.4 else -1)
            event = TickEvent(t, "sector_news", f"News secteur {sector}", move)
        if event:
            events.append(event)

        for i, asset in enumerate(assets):
            s = prices[i]
            # GBM + mean reversion toward anchor
            drift = asset.mu + asset.kappa * (asset.anchor - s) / max(s, 1e-6)
            dW = shocks[i] * math.sqrt(config.dt)
            raw = s * math.exp((drift - 0.5 * asset.sigma**2) * config.dt + asset.sigma * dW)

            if event and event.kind == "sector_news" and asset.sector in event.detail:
                raw *= 1.0 + event.impact
            raw *= global_mult

            # Circuit breaker
            max_up = s * (1.0 + config.circuit_breaker_pct)
            max_dn = s * (1.0 - config.circuit_breaker_pct)
            new_price = min(max(raw, max_dn), max_up)
            new_price = max(new_price, 0.01)
            prices[i] = new_price
            series[asset.symbol].append(round(new_price, 4))

    return SimulationResult(
        assets=[asdict(a) for a in assets],
        series=series,
        events=[asdict(e) for e in events],
        meta={
            "n_ticks": config.n_ticks,
            "seed": config.seed,
            "dt": config.dt,
            "circuit_breaker_pct": config.circuit_breaker_pct,
            "final_prices": {a.symbol: series[a.symbol][-1] for a in assets},
        },
    )


def export_json(result: SimulationResult, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "assets": result.assets,
        "series": result.series,
        "events": result.events,
        "meta": result.meta,
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def export_csv(result: SimulationResult, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    symbols = list(result.series.keys())
    n = len(next(iter(result.series.values())))
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["tick", *symbols])
        for t in range(n):
            writer.writerow([t, *[result.series[s][t] for s in symbols]])


def stability_report(result: SimulationResult) -> dict[str, Any]:
    """Checks that prices stay sane (no explosions / zeros)."""
    report: dict[str, Any] = {"ok": True, "assets": {}}
    for symbol, values in result.series.items():
        mx = max(values)
        mn = min(values)
        start = values[0]
        ratio = mx / max(start, 1e-9)
        drawdown = (mx - mn) / max(mx, 1e-9)
        asset_ok = mn > 0.01 and ratio < 20.0 and all(math.isfinite(v) for v in values)
        report["assets"][symbol] = {
            "min": round(mn, 4),
            "max": round(mx, 4),
            "max_over_start": round(ratio, 3),
            "range_pct": round(drawdown * 100, 2),
            "ok": asset_ok,
        }
        if not asset_ok:
            report["ok"] = False
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="SMC GBM market simulator")
    parser.add_argument("--ticks", type=int, default=500)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", type=str, default="out")
    args = parser.parse_args()

    config = SimConfig(n_ticks=args.ticks, seed=args.seed)
    result = simulate(config=config)
    out = Path(args.out)
    export_json(result, out / "market.json")
    export_csv(result, out / "market.csv")
    report = stability_report(result)
    (out / "stability.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"exported": str(out.resolve()), "stable": report["ok"]}, indent=2))


if __name__ == "__main__":
    main()
