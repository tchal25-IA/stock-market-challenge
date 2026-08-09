"""Stability & sanity tests for the GBM simulator."""

from __future__ import annotations

import math
import unittest

from gbm import SimConfig, simulate, stability_report


class TestGbm(unittest.TestCase):
    def test_series_length(self) -> None:
        result = simulate(config=SimConfig(n_ticks=100, seed=1))
        for symbol, series in result.series.items():
            self.assertEqual(len(series), 101, symbol)

    def test_prices_positive_finite(self) -> None:
        result = simulate(config=SimConfig(n_ticks=300, seed=7))
        for symbol, series in result.series.items():
            for v in series:
                self.assertTrue(math.isfinite(v), f"{symbol} not finite")
                self.assertGreater(v, 0.0, symbol)

    def test_circuit_breaker_bounds(self) -> None:
        cfg = SimConfig(n_ticks=200, seed=99, circuit_breaker_pct=0.05)
        result = simulate(config=cfg)
        for symbol, series in result.series.items():
            for i in range(1, len(series)):
                prev, cur = series[i - 1], series[i]
                move = abs(cur - prev) / prev
                # Allow tiny float slack; events still clamped per tick
                self.assertLessEqual(move, cfg.circuit_breaker_pct + 1e-4, symbol)

    def test_stability_report_ok(self) -> None:
        result = simulate(config=SimConfig(n_ticks=500, seed=42))
        report = stability_report(result)
        self.assertTrue(report["ok"], report)

    def test_determinism(self) -> None:
        a = simulate(config=SimConfig(n_ticks=50, seed=123))
        b = simulate(config=SimConfig(n_ticks=50, seed=123))
        self.assertEqual(a.series, b.series)


if __name__ == "__main__":
    unittest.main()
