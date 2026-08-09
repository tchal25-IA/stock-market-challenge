import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, Pattern, Rect, Line } from 'react-native-svg';
import { api, MarketAsset, Portfolio, TradeRow, LockedAsset, BotInfo } from './src/api';
import { Sparkline } from './src/Sparkline';
import { colors, formatEur, formatPct, sectorLabel, kindColor } from './src/theme';

const TOKEN_KEY = 'smc_token';
const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.26;
const CARD_W = Math.min(width - 40, 420);

type Tab = 'market' | 'portfolio' | 'bots' | 'history';
type MarketMode = 'swipe' | 'list';
type AuthMode = 'welcome' | 'login' | 'register' | 'claim';

function GridBg() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <Line x1="0" y1="28" x2="28" y2="28" stroke="rgba(6,41,31,0.06)" strokeWidth="1" />
            <Line x1="28" y1="0" x2="28" y2="28" stroke="rgba(6,41,31,0.06)" strokeWidth="1" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#grid)" />
      </Svg>
    </View>
  );
}

function KindBadge({ kind, label }: { kind?: string; label?: string }) {
  const c = kindColor[kind ?? 'stock'] ?? colors.accent;
  return (
    <View style={[styles.kindBadge, { borderColor: c }]}>
      <Text style={[styles.kindBadgeText, { color: c }]}>{(label ?? kind ?? 'Action').toUpperCase()}</Text>
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Syne_700Bold,
    Syne_800ExtraBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  const [token, setToken] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [authForm, setAuthForm] = useState({ login: '', email: '', username: '', password: '' });
  const [tab, setTab] = useState<Tab>('market');
  const [marketMode, setMarketMode] = useState<MarketMode>('swipe');
  const [assets, setAssets] = useState<MarketAsset[]>([]);
  const [locked, setLocked] = useState<LockedAsset[]>([]);
  const [index, setIndex] = useState(0);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [bots, setBots] = useState<BotInfo[]>([]);
  const [botsUnlocked, setBotsUnlocked] = useState(false);
  const [botUnlockLevel, setBotUnlockLevel] = useState(11);
  const [tick, setTick] = useState(0);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [buyOpen, setBuyOpen] = useState(false);
  const [buySymbol, setBuySymbol] = useState<string | null>(null);
  const [amount, setAmount] = useState('500');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailHistory, setDetailHistory] = useState<number[]>([]);
  const [detailMeta, setDetailMeta] = useState<{
    blurb?: string;
    changePct: number;
    changePctRange: number;
    glossary: Record<string, string>;
    kindLabel?: string;
    kind?: string;
  } | null>(null);
  const [tutorial, setTutorial] = useState(false);
  const [sellSymbol, setSellSymbol] = useState<string | null>(null);
  const [sellQty, setSellQty] = useState('');
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);

  const pan = useRef(new Animated.ValueXY()).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const current = assets[index];
  const buyAsset = assets.find((a) => a.symbol === buySymbol) ?? current;

  const persistAuth = async (res: { accessToken: string }) => {
    await AsyncStorage.setItem(TOKEN_KEY, res.accessToken);
    setToken(res.accessToken);
    setAuthMode(null);
    await refresh(res.accessToken);
  };

  const refresh = useCallback(async (tok: string) => {
    const [m, p] = await Promise.all([api.market(tok), api.portfolio(tok)]);
    setAssets(m.assets);
    setLocked(m.locked ?? []);
    setTick(m.tick);
    setLastEvent(m.lastEvent);
    setUnlockedCount(m.unlockedCount ?? m.assets.length);
    setTotalCount(m.totalCount ?? m.assets.length);
    setPortfolio(p);
    if (!p.tutorialDone) setTutorial(true);
    setIndex((i) => (m.assets.length ? Math.min(i, m.assets.length - 1) : 0));
  }, []);

  const loadHistory = useCallback(async (tok: string) => {
    setTrades(await api.history(tok));
  }, []);

  const loadBots = useCallback(async (tok: string) => {
    const b = await api.bots(tok);
    setBots(b.bots);
    setBotsUnlocked(b.unlocked);
    setBotUnlockLevel(b.unlockLevel);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const tok = await AsyncStorage.getItem(TOKEN_KEY);
        if (!tok) {
          setAuthMode('welcome');
        } else {
          setToken(tok);
          try {
            await refresh(tok);
          } catch (e) {
            const status = (e as Error & { status?: number }).status;
            if (status === 401 || status === 403) {
              await AsyncStorage.removeItem(TOKEN_KEY);
              setToken(null);
              setAuthMode('welcome');
            } else {
              throw e;
            }
          }
        }
      } catch (e) {
        Alert.alert('Erreur', `API indisponible: ${(e as Error).message}`);
        setAuthMode('welcome');
      } finally {
        setBooting(false);
      }
    })();
  }, [refresh]);

  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => refresh(token).catch(() => undefined), 18000);
    return () => clearInterval(id);
  }, [token, refresh]);

  useEffect(() => {
    if (!token) return;
    if (tab === 'history') loadHistory(token).catch(() => undefined);
    if (tab === 'bots') loadBots(token).catch(() => undefined);
  }, [tab, token, loadHistory, loadBots]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);

  const goNext = useCallback(() => {
    pan.setValue({ x: 0, y: 0 });
    setIndex((i) => (assets.length ? (i + 1) % assets.length : 0));
  }, [assets.length, pan]);

  const openBuy = useCallback((symbol?: string) => {
    pan.setValue({ x: 0, y: 0 });
    setBuySymbol(symbol ?? current?.symbol ?? null);
    setAmount('500');
    setBuyOpen(true);
  }, [pan, current]);

  const confirmBuy = useCallback(async () => {
    if (!token || !buyAsset || busy) return;
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Montant invalide');
      return;
    }
    setBusy(true);
    try {
      await api.buy(token, buyAsset.symbol, value);
      setBuyOpen(false);
      setFlash(true);
      setTimeout(() => setFlash(false), 500);
      await refresh(token);
      if (marketMode === 'swipe') goNext();
    } catch (e) {
      Alert.alert('Achat impossible', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [token, buyAsset, amount, refresh, goNext, busy, marketMode]);

  const openDetail = useCallback(async (asset?: MarketAsset) => {
    const target = asset ?? current;
    if (!token || !target) return;
    const d = await api.asset(token, target.symbol);
    setDetailHistory(d.history.map((h) => h.price));
    setDetailMeta({
      blurb: d.blurb,
      changePct: d.changePct,
      changePctRange: d.changePctRange,
      glossary: d.glossary,
      kind: d.kind,
      kindLabel: d.kindLabel,
    });
    setBuySymbol(target.symbol);
    setDetailOpen(true);
  }, [token, current]);

  const confirmSell = useCallback(async () => {
    if (!token || !sellSymbol || busy) return;
    const qty = Number(sellQty.replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) {
      Alert.alert('Quantité invalide');
      return;
    }
    setBusy(true);
    try {
      await api.sell(token, sellSymbol, qty);
      setSellSymbol(null);
      setSellQty('');
      await refresh(token);
      if (tab === 'history') await loadHistory(token);
    } catch (e) {
      Alert.alert('Vente impossible', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [token, sellSymbol, sellQty, refresh, busy, tab, loadHistory]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
        onPanResponderRelease: (_, g) => {
          if (g.dx > SWIPE_THRESHOLD) {
            Animated.timing(pan, { toValue: { x: width, y: g.dy }, duration: 180, useNativeDriver: false }).start(
              () => openBuy(),
            );
          } else if (g.dx < -SWIPE_THRESHOLD) {
            Animated.timing(pan, { toValue: { x: -width, y: g.dy }, duration: 180, useNativeDriver: false }).start(
              () => goNext(),
            );
          } else {
            Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 6 }).start();
          }
        },
      }),
    [goNext, openBuy, pan],
  );

  const doLevelUp = async () => {
    if (!token) return;
    const res = await api.levelUp(token);
    if (res.ok) {
      const unlocked = (res.unlocked ?? []).map((u) => u.symbol).join(', ');
      Alert.alert(
        `Niveau ${res.level}`,
        [unlocked ? `Débloqué : ${unlocked}` : null, res.educationTip].filter(Boolean).join('\n') || 'Continue.',
      );
      await refresh(token);
      await loadBots(token).catch(() => undefined);
    } else {
      Alert.alert('Pas encore', res.reason ?? 'Objectif non atteint');
    }
  };

  const forceTick = async () => {
    if (!token || busy) return;
    setBusy(true);
    try {
      await api.tick(token);
      setFlash(true);
      setTimeout(() => setFlash(false), 400);
      await refresh(token);
    } finally {
      setBusy(false);
    }
  };

  const submitAuth = async () => {
    setBusy(true);
    try {
      if (authMode === 'welcome') {
        await persistAuth(await api.guest());
      } else if (authMode === 'login') {
        await persistAuth(await api.login(authForm.login, authForm.password));
      } else if (authMode === 'register') {
        await persistAuth(await api.register(authForm.email, authForm.username, authForm.password));
      } else if (authMode === 'claim' && token) {
        await persistAuth(await api.claim(token, authForm.email, authForm.username, authForm.password));
      }
    } catch (e) {
      Alert.alert('Auth', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleBot = async (bot: BotInfo) => {
    if (!token) return;
    await api.configureBot(token, bot.kind, !bot.enabled, bot.allocationPct);
    await loadBots(token);
  };

  const buyHints = useMemo(() => {
    const cash = portfolio?.cash ?? 0;
    return [100, 250, 500, 1000].filter((v) => v <= cash).concat(cash >= 1 ? [Math.floor(cash)] : []);
  }, [portfolio?.cash]);

  const buyOverlay = pan.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' });
  const skipOverlay = pan.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  if (booting || !fontsLoaded) {
    return (
      <LinearGradient colors={[colors.bg0, colors.bg1]} style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Ouverture du marché…</Text>
      </LinearGradient>
    );
  }

  if (authMode && !token) {
    return (
      <LinearGradient colors={[colors.bg0, '#D7EBE3', colors.bg1]} style={styles.root}>
        <StatusBar style="dark" />
        <GridBg />
        <SafeAreaView style={styles.authWrap}>
          <Text style={styles.brand}>Stock Market{'\n'}Challenge</Text>
          <Text style={styles.tagline}>Bourse fictive · swipe · apprends sans risque</Text>

          {authMode === 'welcome' ? (
            <View style={styles.authCard}>
              <Pressable style={[styles.action, styles.buy]} onPress={submitAuth}>
                <Text style={styles.actionLight}>{busy ? '…' : 'Jouer en invité'}</Text>
              </Pressable>
              <Pressable style={[styles.action, styles.skip, { marginTop: 10 }]} onPress={() => setAuthMode('login')}>
                <Text style={styles.actionDark}>Connexion</Text>
              </Pressable>
              <Pressable style={[styles.action, styles.skip, { marginTop: 10 }]} onPress={() => setAuthMode('register')}>
                <Text style={styles.actionDark}>Créer un compte</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.authCard}>
              <Text style={styles.modalTitle}>{authMode === 'login' ? 'Connexion' : 'Créer un compte'}</Text>
              {authMode === 'login' ? (
                <TextInput
                  style={styles.input}
                  placeholder="Email ou username"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  value={authForm.login}
                  onChangeText={(v) => setAuthForm((f) => ({ ...f, login: v }))}
                />
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={authForm.email}
                    onChangeText={(v) => setAuthForm((f) => ({ ...f, email: v }))}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Username"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    value={authForm.username}
                    onChangeText={(v) => setAuthForm((f) => ({ ...f, username: v }))}
                  />
                </>
              )}
              <TextInput
                style={styles.input}
                placeholder="Mot de passe"
                placeholderTextColor={colors.muted}
                secureTextEntry
                value={authForm.password}
                onChangeText={(v) => setAuthForm((f) => ({ ...f, password: v }))}
              />
              <Pressable style={[styles.action, styles.buy, { marginTop: 14 }]} onPress={submitAuth}>
                <Text style={styles.actionLight}>{busy ? '…' : 'Valider'}</Text>
              </Pressable>
              <Pressable onPress={() => setAuthMode('welcome')} style={{ marginTop: 12 }}>
                <Text style={styles.metaText}>← Retour</Text>
              </Pressable>
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const progress = portfolio?.progressPct ?? 0;
  const pnlUp = (portfolio?.totalPnl ?? 0) >= 0;

  return (
    <LinearGradient colors={[colors.bg0, '#D7EBE3', colors.bg1]} style={styles.root}>
      <StatusBar style="dark" />
      <GridBg />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.hero}>
          <Animated.View style={{ opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }}>
            <Text style={styles.liveDot}>● MARCHÉ LIVE · TICK {tick}</Text>
          </Animated.View>
          <View style={styles.heroRow}>
            <Text style={styles.brandCompact}>Stock Market Challenge</Text>
            {portfolio?.isGuest ? (
              <Pressable onPress={() => { setAuthMode('claim'); setAuthForm({ login: '', email: '', username: '', password: '' }); }}>
                <Text style={styles.saveLink}>Sauver</Text>
              </Pressable>
            ) : (
              <Text style={styles.metaText}>@{portfolio?.username}</Text>
            )}
          </View>
          <Text style={styles.tip}>{portfolio?.educationTip}</Text>
        </View>

        <View style={[styles.board, flash && styles.boardFlash]}>
          <View style={styles.boardTop}>
            <View>
              <Text style={styles.boardLabel}>Valeur totale</Text>
              <Text style={styles.boardValue}>{formatEur(portfolio?.totalValue ?? 10000)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.boardLabel}>
                Niv. {portfolio?.level ?? 1}/{portfolio?.maxLevel ?? 20}
              </Text>
              <Text style={[styles.boardPnl, { color: pnlUp ? colors.gain : colors.loss }]}>
                {formatPct(portfolio?.totalPnlPct ?? 0)}
              </Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(4, progress)}%` as `${number}%` }]} />
          </View>
          <View style={styles.boardMeta}>
            <Text style={styles.metaText}>
              Objectif {formatEur(portfolio?.target ?? 15000)} · Cash {formatEur(portfolio?.cash ?? 0)}
            </Text>
            <Text style={styles.metaText}>
              {unlockedCount}/{totalCount}
            </Text>
          </View>
          {lastEvent ? <Text style={styles.event}>{lastEvent}</Text> : null}
          {portfolio?.canLevelUp ? (
            <Pressable style={styles.levelBtn} onPress={doLevelUp}>
              <Text style={styles.levelBtnText}>Passer niveau suivant</Text>
            </Pressable>
          ) : null}
        </View>

        {tab === 'market' ? (
          <View style={styles.deck}>
            <View style={styles.modeRow}>
              <Pressable style={[styles.modeChip, marketMode === 'swipe' && styles.modeOn]} onPress={() => setMarketMode('swipe')}>
                <Text style={[styles.modeText, marketMode === 'swipe' && styles.modeTextOn]}>Swipe</Text>
              </Pressable>
              <Pressable style={[styles.modeChip, marketMode === 'list' && styles.modeOn]} onPress={() => setMarketMode('list')}>
                <Text style={[styles.modeText, marketMode === 'list' && styles.modeTextOn]}>Liste</Text>
              </Pressable>
              <Pressable style={[styles.modeChip, styles.tickChip]} onPress={forceTick}>
                <Text style={styles.modeTextOn}>Tick</Text>
              </Pressable>
            </View>

            {marketMode === 'swipe' && current ? (
              <Animated.View
                style={[
                  styles.card,
                  {
                    transform: [
                      { translateX: pan.x },
                      { translateY: pan.y },
                      {
                        rotate: pan.x.interpolate({
                          inputRange: [-width, 0, width],
                          outputRange: ['-10deg', '0deg', '10deg'],
                        }),
                      },
                    ],
                  },
                ]}
                {...panResponder.panHandlers}
              >
                <Pressable onPress={() => openDetail()} style={styles.cardInner}>
                  <Animated.View style={[styles.stampBuy, { opacity: buyOverlay }]}>
                    <Text style={styles.stampBuyText}>ACHETER</Text>
                  </Animated.View>
                  <Animated.View style={[styles.stampSkip, { opacity: skipOverlay }]}>
                    <Text style={styles.stampSkipText}>PASSER</Text>
                  </Animated.View>
                  <View style={styles.cardHeader}>
                    <KindBadge kind={current.kind} label={current.kindLabel} />
                    <Text style={styles.cardIndex}>
                      {index + 1}/{assets.length}
                    </Text>
                  </View>
                  <Text style={styles.cardSector}>
                    {(sectorLabel[current.sector] ?? current.sector).toUpperCase()}
                  </Text>
                  <Text style={styles.cardSymbol}>{current.symbol}</Text>
                  <Text style={styles.cardName}>{current.name}</Text>
                  {current.blurb ? <Text style={styles.cardBlurb}>{current.blurb}</Text> : null}
                  <View style={styles.priceRow}>
                    <Text style={styles.cardPrice}>{formatEur(current.price)}</Text>
                    <View>
                      <Text style={[styles.chg, { color: current.changePct >= 0 ? colors.gain : colors.loss }]}>
                        {formatPct(current.changePct)} tick
                      </Text>
                      <Text style={[styles.chgDay, { color: current.changePctDay >= 0 ? colors.gain : colors.loss }]}>
                        {formatPct(current.changePctDay)} session
                      </Text>
                    </View>
                  </View>
                  <Sparkline data={current.sparkline?.length ? current.sparkline : [current.price, current.price]} width={CARD_W - 48} />
                  <Text style={styles.hint}>→ acheter · ← ignorer · tap détail</Text>
                </Pressable>
              </Animated.View>
            ) : null}

            {marketMode === 'swipe' ? (
              <View style={styles.row}>
                <Pressable style={[styles.action, styles.skip]} onPress={goNext}>
                  <Text style={styles.actionDark}>Ignorer</Text>
                </Pressable>
                <Pressable style={[styles.action, styles.buy]} onPress={() => openBuy()}>
                  <Text style={styles.actionLight}>Acheter</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView style={{ flex: 1, width: '100%' }} contentContainerStyle={styles.listPad}>
                {assets.map((a) => (
                  <Pressable key={a.symbol} style={styles.pos} onPress={() => openDetail(a)}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.posSym}>{a.symbol}</Text>
                        <KindBadge kind={a.kind} label={a.kindLabel} />
                      </View>
                      <Text style={styles.posMeta}>{a.name}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.posVal}>{formatEur(a.price)}</Text>
                      <Text style={{ color: a.changePct >= 0 ? colors.gain : colors.loss, fontFamily: 'DMSans_700Bold' }}>
                        {formatPct(a.changePct)}
                      </Text>
                      <Pressable style={styles.sellChip} onPress={() => openBuy(a.symbol)}>
                        <Text style={styles.sellChipText}>Acheter</Text>
                      </Pressable>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {locked.length > 0 && marketMode === 'swipe' ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.lockStrip} contentContainerStyle={{ gap: 8 }}>
                {locked.slice(0, 8).map((l) => (
                  <View key={l.symbol} style={styles.lockChip}>
                    <Text style={styles.lockSym}>{l.symbol}</Text>
                    <Text style={styles.lockLvl}>Niv. {l.unlockLevel}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>
        ) : null}

        {tab === 'portfolio' ? (
          <ScrollView contentContainerStyle={styles.listPad} showsVerticalScrollIndicator={false}>
            <View style={styles.allocRow}>
              {(['stock', 'bond', 'commodity'] as const).map((k) => (
                <View key={k} style={styles.allocBox}>
                  <Text style={[styles.allocLabel, { color: kindColor[k] }]}>
                    {k === 'stock' ? 'Actions' : k === 'bond' ? 'Oblig.' : 'Matières'}
                  </Text>
                  <Text style={styles.allocVal}>{formatEur(portfolio?.allocation?.[k] ?? 0, 0)}</Text>
                </View>
              ))}
            </View>
            {(portfolio?.positions ?? []).length === 0 ? (
              <Text style={styles.empty}>Portefeuille vide — swipe ou liste pour acheter.</Text>
            ) : (
              portfolio?.positions.map((p) => (
                <View key={p.symbol} style={styles.pos}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={styles.posSym}>{p.symbol}</Text>
                      <KindBadge kind={p.kind} label={p.kindLabel} />
                    </View>
                    <Text style={styles.posMeta}>
                      {p.quantity.toFixed(3)} × {formatEur(p.price)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text style={styles.posVal}>{formatEur(p.marketValue)}</Text>
                    <Text style={{ color: p.pnl >= 0 ? colors.gain : colors.loss, fontFamily: 'DMSans_700Bold' }}>
                      {formatPct(p.pnlPct)}
                    </Text>
                    <Pressable
                      style={styles.sellChip}
                      onPress={() => {
                        setSellSymbol(p.symbol);
                        setSellQty(String(Number(p.quantity.toFixed(4))));
                      }}
                    >
                      <Text style={styles.sellChipText}>Vendre</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        ) : null}

        {tab === 'bots' ? (
          <ScrollView contentContainerStyle={styles.listPad}>
            {!botsUnlocked ? (
              <View style={styles.unlockBox}>
                <Text style={styles.unlockTitle}>Bots verrouillés</Text>
                <Text style={styles.cardBlurb}>
                  Le bot Hold Champion se débloque au niveau {botUnlockLevel}. Il achète automatiquement des titres
                  stables à chaque tick.
                </Text>
              </View>
            ) : (
              bots.map((b) => (
                <View key={b.kind} style={styles.pos}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.posSym}>{b.name}</Text>
                    <Text style={styles.posMeta}>{b.description}</Text>
                    <Text style={styles.posMeta}>Allocation {b.allocationPct}% du cash</Text>
                  </View>
                  <Pressable style={[styles.sellChip, b.enabled && { backgroundColor: colors.gain }]} onPress={() => toggleBot(b)}>
                    <Text style={styles.sellChipText}>{b.enabled ? 'ON' : 'OFF'}</Text>
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>
        ) : null}

        {tab === 'history' ? (
          <ScrollView contentContainerStyle={styles.listPad}>
            {trades.length === 0 ? (
              <Text style={styles.empty}>Aucun trade pour l’instant.</Text>
            ) : (
              trades.map((t) => (
                <View key={t.id} style={styles.pos}>
                  <View>
                    <Text style={styles.posSym}>
                      {t.side.toUpperCase()} {t.asset.symbol}
                    </Text>
                    <Text style={styles.posMeta}>
                      {new Date(t.createdAt).toLocaleString('fr-FR')}
                      {t.source && t.source !== 'manual' ? ` · ${t.source}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.posVal}>{formatEur(t.total)}</Text>
                </View>
              ))
            )}
          </ScrollView>
        ) : null}

        <View style={styles.tabs}>
          {(
            [
              ['market', 'Marché'],
              ['portfolio', 'Portfolio'],
              ['bots', 'Bots'],
              ['history', 'Histo'],
            ] as const
          ).map(([key, label]) => (
            <Pressable key={key} style={[styles.tab, tab === key && styles.tabOn]} onPress={() => setTab(key)}>
              <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>

      <Modal visible={buyOpen} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Acheter {buyAsset?.symbol}</Text>
            <Text style={styles.posMeta}>
              {buyAsset?.name} · {formatEur(buyAsset?.price ?? 0)}
            </Text>
            <TextInput style={styles.input} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
            <View style={styles.quickRow}>
              {buyHints.map((v, i) => (
                <Pressable key={`${v}-${i}`} style={styles.quick} onPress={() => setAmount(String(v))}>
                  <Text style={styles.quickText}>{i === buyHints.length - 1 ? 'Max' : formatEur(v, 0)}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.row}>
              <Pressable style={[styles.action, styles.skip]} onPress={() => { setBuyOpen(false); pan.setValue({ x: 0, y: 0 }); }}>
                <Text style={styles.actionDark}>Annuler</Text>
              </Pressable>
              <Pressable style={[styles.action, styles.buy]} onPress={confirmBuy}>
                <Text style={styles.actionLight}>{busy ? '…' : 'Confirmer'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!sellSymbol} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Vendre {sellSymbol}</Text>
            <TextInput style={styles.input} keyboardType="decimal-pad" value={sellQty} onChangeText={setSellQty} />
            <View style={styles.quickRow}>
              {[0.25, 0.5, 1].map((f) => {
                const pos = portfolio?.positions.find((p) => p.symbol === sellSymbol);
                if (!pos) return null;
                const q = Number((pos.quantity * f).toFixed(4));
                return (
                  <Pressable key={f} style={styles.quick} onPress={() => setSellQty(String(q))}>
                    <Text style={styles.quickText}>{f === 1 ? 'Tout' : `${f * 100}%`}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.row}>
              <Pressable style={[styles.action, styles.skip]} onPress={() => setSellSymbol(null)}>
                <Text style={styles.actionDark}>Annuler</Text>
              </Pressable>
              <Pressable style={[styles.action, styles.buy]} onPress={confirmSell}>
                <Text style={styles.actionLight}>{busy ? '…' : 'Confirmer'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={detailOpen} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <KindBadge kind={detailMeta?.kind} label={detailMeta?.kindLabel} />
            <Text style={[styles.modalTitle, { marginTop: 8 }]}>{buyAsset?.name ?? current?.name}</Text>
            <Text style={styles.cardPrice}>{formatEur(buyAsset?.price ?? current?.price ?? 0)}</Text>
            <Sparkline data={detailHistory} width={CARD_W - 48} height={96} />
            {detailMeta?.blurb ? <Text style={styles.cardBlurb}>{detailMeta.blurb}</Text> : null}
            <Pressable style={[styles.action, styles.buy, { marginTop: 12 }]} onPress={() => { setDetailOpen(false); openBuy(buyAsset?.symbol); }}>
              <Text style={styles.actionLight}>Acheter</Text>
            </Pressable>
            <Pressable style={[styles.action, styles.skip, { marginTop: 8 }]} onPress={() => setDetailOpen(false)}>
              <Text style={styles.actionDark}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={tutorial} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.brandCompact}>Stock Market Challenge</Text>
            <Text style={styles.modalTitle}>Bienvenue</Text>
            <Text style={styles.cardBlurb}>
              10 000 € fictifs. Actions d’abord, puis obligations (niv. 11) et matières (niv. 15). Un bot Hold t’attend
              au niveau 11. Swipe ou liste pour trader.
            </Text>
            <Pressable
              style={[styles.action, styles.buy, { marginTop: 16 }]}
              onPress={async () => {
                if (token) await api.tutorialDone(token);
                setTutorial(false);
                if (token) await refresh(token);
              }}
            >
              <Text style={styles.actionLight}>Entrer sur le marché</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={authMode === 'claim'} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Sauver la progression</Text>
            <Text style={styles.posMeta}>Conserve ton portefeuille avec un vrai compte.</Text>
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.muted} autoCapitalize="none" value={authForm.email} onChangeText={(v) => setAuthForm((f) => ({ ...f, email: v }))} />
            <TextInput style={styles.input} placeholder="Username" placeholderTextColor={colors.muted} autoCapitalize="none" value={authForm.username} onChangeText={(v) => setAuthForm((f) => ({ ...f, username: v }))} />
            <TextInput style={styles.input} placeholder="Mot de passe (8+, lettres+chiffres)" placeholderTextColor={colors.muted} secureTextEntry value={authForm.password} onChangeText={(v) => setAuthForm((f) => ({ ...f, password: v }))} />
            <View style={styles.row}>
              <Pressable style={[styles.action, styles.skip]} onPress={() => setAuthMode(null)}>
                <Text style={styles.actionDark}>Plus tard</Text>
              </Pressable>
              <Pressable style={[styles.action, styles.buy]} onPress={submitAuth}>
                <Text style={styles.actionLight}>{busy ? '…' : 'Créer'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: colors.muted, fontFamily: 'DMSans_500Medium' },
  authWrap: { flex: 1, padding: 24, justifyContent: 'center' },
  authCard: { marginTop: 28, padding: 18, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  hero: { paddingHorizontal: 22, paddingTop: 4 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  liveDot: { color: colors.accent, fontFamily: 'DMSans_700Bold', fontSize: 11, letterSpacing: 1.4, marginBottom: 6 },
  brand: { fontFamily: 'Syne_800ExtraBold', fontSize: 36, lineHeight: 38, color: colors.ink, letterSpacing: -0.8 },
  brandCompact: { fontFamily: 'Syne_800ExtraBold', fontSize: 22, color: colors.ink, letterSpacing: -0.5, flex: 1 },
  tagline: { marginTop: 10, color: colors.muted, fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20 },
  tip: { marginTop: 6, color: colors.inkSoft, fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 18 },
  saveLink: { color: colors.accent, fontFamily: 'DMSans_700Bold', fontSize: 13 },
  board: { marginHorizontal: 18, marginTop: 10, padding: 14, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  boardFlash: { borderColor: colors.accentHot, backgroundColor: 'rgba(212,243,74,0.18)' },
  boardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  boardLabel: { fontFamily: 'DMSans_500Medium', color: colors.muted, fontSize: 12 },
  boardValue: { fontFamily: 'Syne_700Bold', fontSize: 26, color: colors.ink, marginTop: 2 },
  boardPnl: { fontFamily: 'DMSans_700Bold', fontSize: 16, marginTop: 4 },
  progressTrack: { height: 8, borderRadius: 99, backgroundColor: 'rgba(6,41,31,0.1)', marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.accentHot, borderRadius: 99 },
  boardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  metaText: { fontFamily: 'DMSans_400Regular', color: colors.muted, fontSize: 12 },
  event: { marginTop: 8, color: colors.warn, fontFamily: 'DMSans_500Medium', fontSize: 12 },
  levelBtn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: colors.ink, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  levelBtnText: { color: colors.accentHot, fontFamily: 'DMSans_700Bold' },
  deck: { flex: 1, alignItems: 'center', paddingHorizontal: 18, paddingTop: 8 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 10, width: CARD_W },
  modeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.5)', borderWidth: 1, borderColor: colors.line },
  modeOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tickChip: { marginLeft: 'auto', backgroundColor: colors.accent, borderColor: colors.accent },
  modeText: { fontFamily: 'DMSans_700Bold', color: colors.inkSoft, fontSize: 12 },
  modeTextOn: { color: colors.white, fontFamily: 'DMSans_700Bold', fontSize: 12 },
  card: { width: CARD_W, minHeight: 300, borderRadius: 24, backgroundColor: colors.surfaceSolid, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  cardInner: { flex: 1, padding: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kindBadge: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  kindBadgeText: { fontFamily: 'DMSans_700Bold', fontSize: 10, letterSpacing: 0.8 },
  cardSector: { fontFamily: 'DMSans_700Bold', color: colors.muted, letterSpacing: 1.2, fontSize: 11, marginTop: 10 },
  cardIndex: { fontFamily: 'DMSans_500Medium', color: colors.muted, fontSize: 12 },
  cardSymbol: { fontFamily: 'Syne_800ExtraBold', fontSize: 40, color: colors.ink, marginTop: 4, letterSpacing: -1 },
  cardName: { fontFamily: 'DMSans_500Medium', fontSize: 15, color: colors.inkSoft },
  cardBlurb: { fontFamily: 'DMSans_400Regular', color: colors.muted, marginTop: 8, lineHeight: 20 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14, marginBottom: 8 },
  cardPrice: { fontFamily: 'Syne_700Bold', fontSize: 28, color: colors.ink },
  chg: { fontFamily: 'DMSans_700Bold', fontSize: 14, textAlign: 'right' },
  chgDay: { fontFamily: 'DMSans_500Medium', fontSize: 12, textAlign: 'right', marginTop: 2 },
  hint: { marginTop: 10, color: colors.muted, fontFamily: 'DMSans_400Regular', fontSize: 12 },
  stampBuy: { position: 'absolute', top: 22, left: 16, borderWidth: 3, borderColor: colors.gain, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, transform: [{ rotate: '-12deg' }], zIndex: 2 },
  stampBuyText: { color: colors.gain, fontFamily: 'Syne_800ExtraBold', fontSize: 16 },
  stampSkip: { position: 'absolute', top: 22, right: 16, borderWidth: 3, borderColor: colors.loss, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, transform: [{ rotate: '12deg' }], zIndex: 2 },
  stampSkipText: { color: colors.loss, fontFamily: 'Syne_800ExtraBold', fontSize: 16 },
  row: { flexDirection: 'row', gap: 10, marginTop: 14, width: CARD_W },
  action: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center' },
  skip: { backgroundColor: 'rgba(6,41,31,0.08)' },
  buy: { backgroundColor: colors.ink },
  actionLight: { color: colors.white, fontFamily: 'DMSans_700Bold' },
  actionDark: { color: colors.ink, fontFamily: 'DMSans_700Bold' },
  lockStrip: { marginTop: 12, maxHeight: 54, width: CARD_W },
  lockChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(6,41,31,0.06)', borderWidth: 1, borderColor: colors.line },
  lockSym: { fontFamily: 'DMSans_700Bold', color: colors.ink, fontSize: 12 },
  lockLvl: { fontFamily: 'DMSans_400Regular', color: colors.muted, fontSize: 10 },
  tabs: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 10, gap: 6, paddingBottom: 12 },
  tab: { flex: 1, paddingVertical: 11, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.45)', alignItems: 'center', borderWidth: 1, borderColor: colors.line },
  tabOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabText: { color: colors.inkSoft, fontFamily: 'DMSans_700Bold', fontSize: 12 },
  tabTextOn: { color: colors.accentHot },
  listPad: { padding: 16, gap: 10, paddingBottom: 24, width: '100%' },
  pos: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.line, gap: 12 },
  posSym: { fontFamily: 'Syne_700Bold', fontSize: 17, color: colors.ink },
  posMeta: { fontFamily: 'DMSans_400Regular', color: colors.muted, marginTop: 4, fontSize: 12, lineHeight: 18 },
  posVal: { fontFamily: 'DMSans_700Bold', color: colors.ink, fontSize: 14 },
  sellChip: { marginTop: 2, backgroundColor: colors.ink, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  sellChipText: { color: colors.accentHot, fontFamily: 'DMSans_700Bold', fontSize: 12 },
  allocRow: { flexDirection: 'row', gap: 8 },
  allocBox: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colors.line },
  allocLabel: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
  allocVal: { fontFamily: 'Syne_700Bold', color: colors.ink, marginTop: 4, fontSize: 14 },
  unlockBox: { padding: 16, borderRadius: 16, backgroundColor: 'rgba(212,243,74,0.25)', borderWidth: 1, borderColor: 'rgba(11,110,79,0.2)' },
  unlockTitle: { fontFamily: 'DMSans_700Bold', color: colors.ink, marginBottom: 6 },
  empty: { color: colors.muted, fontFamily: 'DMSans_400Regular', textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
  modalBg: { flex: 1, backgroundColor: 'rgba(6,41,31,0.55)', justifyContent: 'center', padding: 22 },
  modal: { backgroundColor: colors.surfaceSolid, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.line },
  modalTitle: { fontFamily: 'Syne_700Bold', fontSize: 22, color: colors.ink },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, marginTop: 10, fontSize: 16, fontFamily: 'DMSans_500Medium', color: colors.ink, backgroundColor: '#fff' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  quick: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(11,110,79,0.1)' },
  quickText: { fontFamily: 'DMSans_700Bold', color: colors.accent, fontSize: 12 },
});
