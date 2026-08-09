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
    const err = new Error(body || res.statusText) as Error & { status?: number };
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
  tutorialDone: boolean;
  positions: Array<{
    symbol: string;
    name: string;
    quantity: number;
    price: number;
    marketValue: number;
    pnl: number;
    pnlPct: number;
  }>;
};

export const api = {
  guest: () => request<AuthResponse>('/auth/guest', { method: 'POST' }),
  market: (token: string) =>
    request<{ tick: number; lastEvent: string | null; assets: MarketAsset[] }>('/market', {
      token,
    }),
  asset: (token: string, symbol: string) =>
    request<{
      symbol: string;
      name: string;
      sector: string;
      price: number;
      history: Array<{ tick: number; price: number }>;
      glossary: Record<string, string>;
    }>(`/market/assets/${symbol}`, { token }),
  portfolio: (token: string) => request<Portfolio>('/portfolio', { token }),
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
  levelUp: (token: string) => request('/portfolio/level-up', { method: 'POST', token }),
};
