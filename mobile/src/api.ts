/** API base — override with EXPO_PUBLIC_API_URL (Vercel / LAN). */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://stock-market-challenge-api.vercel.app/api';

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    let message = body || res.statusText;
    try {
      const parsed = JSON.parse(body) as { message?: string | string[] };
      if (Array.isArray(parsed.message)) message = parsed.message.join(', ');
      else if (parsed.message) message = parsed.message;
    } catch {
      /* raw text */
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

export type AuthUser = {
  id: string;
  username: string;
  level: number;
  cash: number;
  tutorialDone: boolean;
  isGuest: boolean;
};

export type AuthResponse = { accessToken: string; user: AuthUser };

export type MarketAsset = {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  price: number;
  unlockLevel: number;
  blurb?: string;
  changePct: number;
  changePctDay: number;
  sparkline: number[];
};

export type LockedAsset = {
  symbol: string;
  name: string;
  sector: string;
  unlockLevel: number;
};

export type MarketResponse = {
  tick: number;
  lastEvent: string | null;
  assets: MarketAsset[];
  locked: LockedAsset[];
  unlockedCount: number;
  totalCount: number;
};

export type Portfolio = {
  cash: number;
  holdingsValue: number;
  totalValue: number;
  totalPnl: number;
  totalPnlPct: number;
  level: number;
  target: number;
  targetReached: boolean;
  canLevelUp: boolean;
  maxLevel: number;
  progressPct: number;
  tutorialDone: boolean;
  nextUnlocks: Array<{ symbol: string; name: string; unlockLevel: number }>;
  unlockedCount: number;
  positions: Array<{
    symbol: string;
    name: string;
    sector?: string;
    quantity: number;
    avgCost?: number;
    price: number;
    marketValue: number;
    pnl: number;
    pnlPct: number;
  }>;
};

export type TradeRow = {
  id: string;
  side: string;
  quantity: number;
  price: number;
  total: number;
  createdAt: string;
  asset: { symbol: string; name: string };
};

export const api = {
  guest: () => request<AuthResponse>('/auth/guest', { method: 'POST' }),
  market: (token: string) => request<MarketResponse>('/market', { token }),
  asset: (token: string, symbol: string) =>
    request<{
      symbol: string;
      name: string;
      sector: string;
      price: number;
      blurb?: string;
      changePct: number;
      changePctRange: number;
      history: Array<{ tick: number; price: number }>;
      glossary: Record<string, string>;
    }>(`/market/assets/${symbol}`, { token }),
  portfolio: (token: string) => request<Portfolio>('/portfolio', { token }),
  history: (token: string) => request<TradeRow[]>('/portfolio/history', { token }),
  buy: (token: string, symbol: string, amountEur: number) =>
    request('/trading/buy', {
      method: 'POST',
      token,
      body: JSON.stringify({ symbol, amountEur }),
    }),
  sell: (token: string, symbol: string, quantity: number) =>
    request('/trading/sell', {
      method: 'POST',
      token,
      body: JSON.stringify({ symbol, quantity }),
    }),
  tick: (token: string) => request('/market/tick', { method: 'POST', token }),
  tutorialDone: (token: string) =>
    request('/portfolio/tutorial-done', { method: 'POST', token }),
  levelUp: (token: string) =>
    request<{ ok: boolean; level?: number; reason?: string; unlocked?: Array<{ symbol: string; name: string }> }>(
      '/portfolio/level-up',
      { method: 'POST', token },
    ),
};
