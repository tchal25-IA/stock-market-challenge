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
import { api, MarketAsset, Portfolio, TradeRow, LockedAsset } from './src/api';
import { Sparkline } from './src/Sparkline';
import { colors, formatEur, formatPct, sectorLabel } from './src/theme';

const TOKEN_KEY = 'smc_token';
const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.26;
const CARD_W = Math.min(width - 40, 420);

type Tab = 'market' | 'portfolio' | 'history';

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

export default function App() {
  const [fontsLoaded] = useFonts({
    Syne_700Bold,
    Syne_800ExtraBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('market');
  const [assets, setAssets] = useState<MarketAsset[]>([]);
  const [locked, setLocked] = useState<LockedAsset[]>([]);
  const [index, setIndex] = useState(0);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [tick, setTick] = useState(0);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [buyOpen, setBuyOpen] = useState(false);
  const [amount, setAmount] = useState('500');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailHistory, setDetailHistory] = useState<number[]>([]);
  const [detailMeta, setDetailMeta] = useState<{ blurb?: string; changePct: number; changePctRange: number; glossary: Record<string, string> } | null>(null);
  const [tutorial, setTutorial] = useState(false);
  const [sellSymbol, setSellSymbol] = useState<string | null>(null);
  const [sellQty, setSellQty] = useState('');
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);

  const pan = useRef(new Animated.ValueXY()).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const current = assets[index];

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
    const h = await api.history(tok);
    setTrades(h);
  }, []);

  const startGuest = useCallback(async () => {
    const auth = await api.guest();
    await AsyncStorage.setItem(TOKEN_KEY, auth.accessToken);
    setToken(auth.accessToken);
    await refresh(auth.accessToken);
    return auth.accessToken;
  }, [refresh]);

  useEffect(() => {
    (async () => {
      try {
        let tok = await AsyncStorage.getItem(TOKEN_KEY);
        if (!tok) {
          tok = await startGuest();
        } else {
          setToken(tok);
          try {
            await refresh(tok);
          } catch (e) {
            const status = (e as Error & { status?: number }).status;
            if (status === 401 || status === 403) {
              await AsyncStorage.removeItem(TOKEN_KEY);
              await startGuest();
            } else {
              throw e;
            }
          }
        }
      } catch (e) {
        Alert.alert('Erreur', `API indisponible: ${(e as Error).message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh, startGuest]);

  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      refresh(token).catch(() => undefined);
    }, 18000);
    return () => clearInterval(id);
  }, [token, refresh]);

  useEffect(() => {
    if (tab === 'history' && token) {
      loadHistory(token).catch(() => undefined);
    }
  }, [tab, token, loadHistory]);

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

  const openBuy = useCallback(() => {
    pan.setValue({ x: 0, y: 0 });
    setAmount('500');
    setBuyOpen(true);
  }, [pan]);

  const confirmBuy = useCallback(async () => {
    if (!token || !current || busy) return;
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Montant invalide');
      return;
    }
    setBusy(true);
    try {
      await api.buy(token, current.symbol, value);
      setBuyOpen(false);
      setFlash(true);
      setTimeout(() => setFlash(false), 500);
      await refresh(token);
      goNext();
    } catch (e) {
      Alert.alert('Achat impossible', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [token, current, amount, refresh, goNext, busy]);

  const openDetail = useCallback(async () => {
    if (!token || !current) return;
    const d = await api.asset(token, current.symbol);
    setDetailHistory(d.history.map((h) => h.price));
    setDetailMeta({
      blurb: d.blurb,
      changePct: d.changePct,
      changePctRange: d.changePctRange,
      glossary: d.glossary,
    });
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
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_, g) => {
          if (g.dx > SWIPE_THRESHOLD) {
            Animated.timing(pan, { toValue: { x: width, y: g.dy }, duration: 180, useNativeDriver: false }).start(
              () => openBuy(),
            );
          } else if (g.dx < -SWIPE_THRESHOLD) {
            Animated.timing(pan, {
              toValue: { x: -width, y: g.dy },
              duration: 180,
              useNativeDriver: false,
            }).start(() => goNext());
          } else {
            Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 6 }).start();
          }
        },
      }),
    [goNext, openBuy, pan],
  );

  const closeTutorial = async () => {
    if (token) await api.tutorialDone(token);
    setTutorial(false);
    if (token) await refresh(token);
  };

  const doLevelUp = async () => {
    if (!token) return;
    const res = await api.levelUp(token);
    if (res.ok) {
      const unlocked = (res.unlocked ?? []).map((u) => u.symbol).join(', ');
      Alert.alert(
        `Niveau ${res.level}`,
        unlocked ? `Nouveaux titres débloqués : ${unlocked}` : 'Objectif validé — continue.',
      );
      await refresh(token);
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

  const buyHints = useMemo(() => {
    const cash = portfolio?.cash ?? 0;
    return [100, 250, 500, 1000].filter((v) => v <= cash).concat(cash >= 1 ? [Math.floor(cash)] : []);
  }, [portfolio?.cash]);

  const buyOverlay = pan.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const skipOverlay = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  if (loading || !fontsLoaded) {
    return (
      <LinearGradient colors={[colors.bg0, colors.bg1]} style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Ouverture du marché…</Text>
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
          <Text style={styles.brand}>Stock Market{'\n'}Challenge</Text>
          <Text style={styles.tagline}>Portefeuille fictif · swipe pour trader · apprends sans risque</Text>
        </View>

        <View style={[styles.board, flash && styles.boardFlash]}>
          <View style={styles.boardTop}>
            <View>
              <Text style={styles.boardLabel}>Valeur totale</Text>
              <Text style={styles.boardValue}>{formatEur(portfolio?.totalValue ?? 10000)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.boardLabel}>
                Niv. {portfolio?.level ?? 1}/{portfolio?.maxLevel ?? 10}
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
              {unlockedCount}/{totalCount} titres
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
            {current ? (
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
                <Pressable onPress={openDetail} style={styles.cardInner}>
                  <Animated.View style={[styles.stampBuy, { opacity: buyOverlay }]}>
                    <Text style={styles.stampBuyText}>ACHETER</Text>
                  </Animated.View>
                  <Animated.View style={[styles.stampSkip, { opacity: skipOverlay }]}>
                    <Text style={styles.stampSkipText}>PASSER</Text>
                  </Animated.View>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardSector}>
                      {(sectorLabel[current.sector] ?? current.sector).toUpperCase()}
                    </Text>
                    <Text style={styles.cardIndex}>
                      {index + 1}/{assets.length}
                    </Text>
                  </View>
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
            ) : (
              <Text style={styles.empty}>Aucun titre débloqué</Text>
            )}

            <View style={styles.row}>
              <Pressable style={[styles.action, styles.skip]} onPress={goNext}>
                <Text style={styles.actionDark}>Ignorer</Text>
              </Pressable>
              <Pressable style={[styles.action, styles.tickBtn]} onPress={forceTick}>
                <Text style={styles.actionLight}>Tick</Text>
              </Pressable>
              <Pressable style={[styles.action, styles.buy]} onPress={openBuy}>
                <Text style={styles.actionLight}>Acheter</Text>
              </Pressable>
            </View>

            {locked.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.lockStrip} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
                {locked.slice(0, 6).map((l) => (
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
            {(portfolio?.positions ?? []).length === 0 ? (
              <Text style={styles.empty}>Portefeuille vide — swipe à droite pour acheter.</Text>
            ) : (
              portfolio?.positions.map((p) => (
                <View key={p.symbol} style={styles.pos}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.posSym}>{p.symbol}</Text>
                    <Text style={styles.posMeta}>
                      {p.quantity.toFixed(3)} × {formatEur(p.price)} · moy. {formatEur(p.avgCost ?? p.price)}
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
            {(portfolio?.nextUnlocks?.length ?? 0) > 0 ? (
              <View style={styles.unlockBox}>
                <Text style={styles.unlockTitle}>Prochain déblocage</Text>
                {portfolio?.nextUnlocks.map((u) => (
                  <Text key={u.symbol} style={styles.unlockItem}>
                    {u.symbol} — {u.name} (niv. {u.unlockLevel})
                  </Text>
                ))}
              </View>
            ) : null}
          </ScrollView>
        ) : null}

        {tab === 'history' ? (
          <ScrollView contentContainerStyle={styles.listPad} showsVerticalScrollIndicator={false}>
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
                      {new Date(t.createdAt).toLocaleString('fr-FR')} · {t.quantity.toFixed(3)} @ {formatEur(t.price)}
                    </Text>
                  </View>
                  <Text style={[styles.posVal, { color: t.side === 'buy' ? colors.ink : colors.gain }]}>
                    {formatEur(t.total)}
                  </Text>
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
              ['history', 'Historique'],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              style={[styles.tab, tab === key && styles.tabOn]}
              onPress={() => setTab(key)}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>

      <Modal visible={buyOpen} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Acheter {current?.symbol}</Text>
            <Text style={styles.posMeta}>
              {current?.name} · {formatEur(current?.price ?? 0)} · cash {formatEur(portfolio?.cash ?? 0)}
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
              placeholder="Montant €"
              placeholderTextColor={colors.muted}
            />
            <View style={styles.quickRow}>
              {buyHints.map((v, i) => (
                <Pressable key={`${v}-${i}`} style={styles.quick} onPress={() => setAmount(String(v))}>
                  <Text style={styles.quickText}>{i === buyHints.length - 1 ? 'Max' : formatEur(v, 0)}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.row}>
              <Pressable
                style={[styles.action, styles.skip]}
                onPress={() => {
                  setBuyOpen(false);
                  pan.setValue({ x: 0, y: 0 });
                }}
              >
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
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={sellQty}
              onChangeText={setSellQty}
              placeholder="Quantité"
              placeholderTextColor={colors.muted}
            />
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
            <Text style={styles.modalTitle}>{current?.name}</Text>
            <Text style={styles.cardPrice}>{formatEur(current?.price ?? 0)}</Text>
            <Text style={{ color: (detailMeta?.changePct ?? 0) >= 0 ? colors.gain : colors.loss, fontFamily: 'DMSans_700Bold', marginBottom: 8 }}>
              {formatPct(detailMeta?.changePct ?? 0)} tick · {formatPct(detailMeta?.changePctRange ?? 0)} période
            </Text>
            {detailMeta?.blurb ? <Text style={styles.cardBlurb}>{detailMeta.blurb}</Text> : null}
            <Sparkline data={detailHistory} width={CARD_W - 48} height={96} />
            <Text style={styles.unlockTitle}>Glossaire</Text>
            {Object.values(detailMeta?.glossary ?? {}).map((v) => (
              <Text key={v} style={styles.posMeta}>
                · {v}
              </Text>
            ))}
            <Pressable style={[styles.action, styles.buy, { marginTop: 16 }]} onPress={() => setDetailOpen(false)}>
              <Text style={styles.actionLight}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={tutorial} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.brandSmall}>Stock Market Challenge</Text>
            <Text style={styles.modalTitle}>Bienvenue, trader</Text>
            <Text style={styles.cardBlurb}>
              10 000 € fictifs, 8 titres dès le niveau 1, jusqu’à 15 au fil des niveaux. Swipe droite = acheter, gauche =
              passer. Atteins l’objectif pour débloquer de nouveaux titres. Zéro risque réel.
            </Text>
            <Pressable style={[styles.action, styles.buy, { marginTop: 16 }]} onPress={closeTutorial}>
              <Text style={styles.actionLight}>Entrer sur le marché</Text>
            </Pressable>
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
  hero: { paddingHorizontal: 22, paddingTop: 6 },
  liveDot: {
    color: colors.accent,
    fontFamily: 'DMSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  brand: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 34,
    lineHeight: 36,
    color: colors.ink,
    letterSpacing: -0.8,
  },
  brandSmall: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 18,
    color: colors.accent,
    marginBottom: 4,
  },
  tagline: {
    marginTop: 8,
    color: colors.muted,
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 320,
  },
  board: {
    marginHorizontal: 18,
    marginTop: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  boardFlash: { borderColor: colors.accentHot, backgroundColor: 'rgba(212,243,74,0.18)' },
  boardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  boardLabel: { fontFamily: 'DMSans_500Medium', color: colors.muted, fontSize: 12 },
  boardValue: { fontFamily: 'Syne_700Bold', fontSize: 28, color: colors.ink, marginTop: 2 },
  boardPnl: { fontFamily: 'DMSans_700Bold', fontSize: 18, marginTop: 4 },
  progressTrack: {
    height: 8,
    borderRadius: 99,
    backgroundColor: 'rgba(6,41,31,0.1)',
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.accentHot, borderRadius: 99 },
  boardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  metaText: { fontFamily: 'DMSans_400Regular', color: colors.muted, fontSize: 12 },
  event: { marginTop: 8, color: colors.warn, fontFamily: 'DMSans_500Medium', fontSize: 12 },
  levelBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  levelBtnText: { color: colors.accentHot, fontFamily: 'DMSans_700Bold' },
  deck: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  card: {
    width: CARD_W,
    minHeight: 320,
    borderRadius: 24,
    backgroundColor: colors.surfaceSolid,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  cardInner: { flex: 1, padding: 22 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardSector: {
    fontFamily: 'DMSans_700Bold',
    color: colors.accent,
    letterSpacing: 1.2,
    fontSize: 11,
  },
  cardIndex: { fontFamily: 'DMSans_500Medium', color: colors.muted, fontSize: 12 },
  cardSymbol: { fontFamily: 'Syne_800ExtraBold', fontSize: 42, color: colors.ink, marginTop: 10, letterSpacing: -1 },
  cardName: { fontFamily: 'DMSans_500Medium', fontSize: 16, color: colors.inkSoft, marginTop: 2 },
  cardBlurb: { fontFamily: 'DMSans_400Regular', color: colors.muted, marginTop: 8, lineHeight: 20 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 18, marginBottom: 10 },
  cardPrice: { fontFamily: 'Syne_700Bold', fontSize: 30, color: colors.ink },
  chg: { fontFamily: 'DMSans_700Bold', fontSize: 14, textAlign: 'right' },
  chgDay: { fontFamily: 'DMSans_500Medium', fontSize: 12, textAlign: 'right', marginTop: 2 },
  hint: { marginTop: 12, color: colors.muted, fontFamily: 'DMSans_400Regular', fontSize: 12 },
  stampBuy: {
    position: 'absolute',
    top: 24,
    left: 18,
    borderWidth: 3,
    borderColor: colors.gain,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    transform: [{ rotate: '-12deg' }],
    zIndex: 2,
  },
  stampBuyText: { color: colors.gain, fontFamily: 'Syne_800ExtraBold', fontSize: 18 },
  stampSkip: {
    position: 'absolute',
    top: 24,
    right: 18,
    borderWidth: 3,
    borderColor: colors.loss,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    transform: [{ rotate: '12deg' }],
    zIndex: 2,
  },
  stampSkipText: { color: colors.loss, fontFamily: 'Syne_800ExtraBold', fontSize: 18 },
  row: { flexDirection: 'row', gap: 10, marginTop: 16, width: CARD_W },
  action: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  skip: { backgroundColor: 'rgba(6,41,31,0.08)' },
  buy: { backgroundColor: colors.ink },
  tickBtn: { backgroundColor: colors.accent, flex: 0.7 },
  actionLight: { color: colors.white, fontFamily: 'DMSans_700Bold' },
  actionDark: { color: colors.ink, fontFamily: 'DMSans_700Bold' },
  lockStrip: { marginTop: 14, maxHeight: 54, width: CARD_W },
  lockChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(6,41,31,0.06)',
    borderWidth: 1,
    borderColor: colors.line,
  },
  lockSym: { fontFamily: 'DMSans_700Bold', color: colors.ink, fontSize: 12 },
  lockLvl: { fontFamily: 'DMSans_400Regular', color: colors.muted, fontSize: 10 },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    paddingBottom: 14,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabText: { color: colors.inkSoft, fontFamily: 'DMSans_700Bold', fontSize: 13 },
  tabTextOn: { color: colors.accentHot },
  listPad: { padding: 18, gap: 10, paddingBottom: 24 },
  pos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 12,
  },
  posSym: { fontFamily: 'Syne_700Bold', fontSize: 18, color: colors.ink },
  posMeta: { fontFamily: 'DMSans_400Regular', color: colors.muted, marginTop: 4, fontSize: 12, lineHeight: 18 },
  posVal: { fontFamily: 'DMSans_700Bold', color: colors.ink, fontSize: 15 },
  sellChip: {
    marginTop: 2,
    backgroundColor: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  sellChipText: { color: colors.accentHot, fontFamily: 'DMSans_700Bold', fontSize: 12 },
  unlockBox: {
    marginTop: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(212,243,74,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(11,110,79,0.2)',
  },
  unlockTitle: { fontFamily: 'DMSans_700Bold', color: colors.ink, marginBottom: 6 },
  unlockItem: { fontFamily: 'DMSans_400Regular', color: colors.inkSoft, marginTop: 2 },
  empty: { color: colors.muted, fontFamily: 'DMSans_400Regular', textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(6,41,31,0.55)',
    justifyContent: 'center',
    padding: 22,
  },
  modal: {
    backgroundColor: colors.surfaceSolid,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.line,
  },
  modalTitle: { fontFamily: 'Syne_700Bold', fontSize: 24, color: colors.ink },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    fontSize: 18,
    fontFamily: 'DMSans_500Medium',
    color: colors.ink,
    backgroundColor: '#fff',
  },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  quick: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(11,110,79,0.1)',
  },
  quickText: { fontFamily: 'DMSans_700Bold', color: colors.accent, fontSize: 12 },
});
