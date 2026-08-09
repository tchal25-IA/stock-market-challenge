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
      /* raw */
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
  email?: string | null;
  level: number;
  cash: number;
  tutorialDone: boolean;
  isGuest: boolean;
};

export type AuthResponse = { accessToken: string; user: AuthUser };

export type AssetKind = 'stock' | 'bond' | 'commodity';

export type MarketAsset = {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  kind: AssetKind;
  kindLabel: string;
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
  kind: string;
  kindLabel: string;
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
  nextUnlocks: Array<{ symbol: string; name: string; kind?: string; unlockLevel: number }>;
  unlockedCount: number;
  botUnlockLevel: number;
  educationTip: string;
  allocation: { stock: number; bond: number; commodity: number };
  isGuest: boolean;
  username: string;
  email?: string | null;
  positions: Array<{
    symbol: string;
    name: string;
    sector?: string;
    kind?: AssetKind;
    kindLabel?: string;
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
  source?: string;
  createdAt: string;
  asset: { symbol: string; name: string; kind?: string };
};

export type BotInfo = {
  id: string;
  kind: string;
  name: string;
  description: string;
  enabled: boolean;
  allocationPct: number;
};

export const api = {
  guest: () => request<AuthResponse>('/auth/guest', { method: 'POST' }),
  register: (email: string, username: string, password: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    }),
  login: (login: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    }),
  claim: (token: string, email: string, username: string, password: string) =>
    request<AuthResponse>('/auth/claim', {
      method: 'POST',
      token,
      body: JSON.stringify({ email, username, password }),
    }),
  me: (token: string) => request<AuthUser>('/auth/me', { token }),
  market: (token: string) => request<MarketResponse>('/market', { token }),
  asset: (token: string, symbol: string) =>
    request<{
      symbol: string;
      name: string;
      sector: string;
      kind: AssetKind;
      kindLabel: string;
      price: number;
      blurb?: string;
      changePct: number;
      changePctRange: number;
      history: Array<{ tick: number; price: number }>;
      glossary: Record<string, string>;
    }>(`/market/assets/${symbol}`, { token }),
  portfolio: (token: string) => request<Portfolio>('/portfolio', { token }),
  history: (token: string) => request<TradeRow[]>('/portfolio/history', { token }),
  bots: (token: string) =>
    request<{ unlockLevel: number; unlocked: boolean; bots: BotInfo[] }>('/bots', { token }),
  configureBot: (token: string, kind: string, enabled: boolean, allocationPct: number) =>
    request('/bots/configure', {
      method: 'POST',
      token,
      body: JSON.stringify({ kind, enabled, allocationPct }),
    }),
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
    request<{
      ok: boolean;
      level?: number;
      reason?: string;
      unlocked?: Array<{ symbol: string; name: string; kind?: string }>;
      educationTip?: string | null;
    }>('/portfolio/level-up', { method: 'POST', token }),
};
