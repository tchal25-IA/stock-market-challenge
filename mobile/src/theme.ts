/** Design tokens — Stock Market Challenge */
export const colors = {
  bg0: '#E4F0EB',
  bg1: '#C5DED4',
  ink: '#06291F',
  inkSoft: '#1A4338',
  muted: '#4F6B61',
  surface: 'rgba(255,255,255,0.72)',
  surfaceSolid: '#F4FBF8',
  line: 'rgba(6,41,31,0.12)',
  accent: '#0B6E4F',
  accentHot: '#D4F34A',
  gain: '#0F8A5F',
  loss: '#D64545',
  warn: '#C47A12',
  white: '#FFFFFF',
};

export function formatEur(n: number, digits = 2) {
  return `${n.toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: 0 })} €`;
}

export function formatPct(n: number, digits = 2) {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}%`;
}

export const sectorLabel: Record<string, string> = {
  tech: 'Tech',
  consumer: 'Conso',
  energy: 'Énergie',
  health: 'Santé',
  finance: 'Finance',
  industrial: 'Industrie',
  materials: 'Matériaux',
  utilities: 'Utilities',
};
