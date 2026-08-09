import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Polyline } from 'react-native-svg';
import { api, MarketAsset, Portfolio } from './src/api';

const TOKEN_KEY = 'smc_token';
const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.28;

type Tab = 'market' | 'portfolio';

function formatEur(n: number) {
  return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €`;
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = width - 64;
  const h = 80;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 8) - 4;
      return `${x},${y}`;
    })
    .join(' ');
  const up = data[data.length - 1] >= data[0];
  return (
    <Svg width={w} height={h}>
      <Polyline points={points} fill="none" stroke={up ? '#1B7F4A' : '#B42318'} strokeWidth={2} />
    </Svg>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('market');
  const [assets, setAssets] = useState<MarketAsset[]>([]);
  const [index, setIndex] = useState(0);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [tick, setTick] = useState(0);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [amount, setAmount] = useState('500');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailHistory, setDetailHistory] = useState<number[]>([]);
  const [glossary, setGlossary] = useState<Record<string, string>>({});
  const [tutorial, setTutorial] = useState(false);

  const pan = useRef(new Animated.ValueXY()).current;
  const current = assets[index];

  const refresh = useCallback(async (tok: string) => {
    const [m, p] = await Promise.all([api.market(tok), api.portfolio(tok)]);
    setAssets(m.assets);
    setTick(m.tick);
    setLastEvent(m.lastEvent);
    setPortfolio(p);
    if (!p.tutorialDone) setTutorial(true);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        let tok = await AsyncStorage.getItem(TOKEN_KEY);
        if (!tok) {
          const auth = await api.guest();
          tok = auth.accessToken;
          await AsyncStorage.setItem(TOKEN_KEY, tok);
        }
        setToken(tok);
        await refresh(tok);
      } catch (e) {
        Alert.alert('Erreur', `API indisponible: ${(e as Error).message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      refresh(token).catch(() => undefined);
    }, 20000);
    return () => clearInterval(id);
  }, [token, refresh]);

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
    if (!token || !current) return;
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Montant invalide');
      return;
    }
    try {
      await api.buy(token, current.symbol, value);
      setBuyOpen(false);
      await refresh(token);
      goNext();
    } catch (e) {
      Alert.alert('Achat impossible', (e as Error).message);
    }
  }, [token, current, amount, refresh, goNext]);

  const openDetail = useCallback(async () => {
    if (!token || !current) return;
    const d = await api.asset(token, current.symbol);
    setDetailHistory(d.history.map((h) => h.price));
    setGlossary(d.glossary);
    setDetailOpen(true);
  }, [token, current]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8,
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
            Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
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
    const res = (await api.levelUp(token)) as { ok: boolean; level?: number; reason?: string };
    if (res.ok) {
      Alert.alert('Niveau supérieur', `Tu es maintenant niveau ${res.level}`);
      await refresh(token);
    } else {
      Alert.alert('Pas encore', res.reason ?? 'Objectif non atteint');
    }
  };

  const forceTick = async () => {
    if (!token) return;
    await api.tick(token);
    await refresh(token);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0F3D2E" />
        <Text style={styles.muted}>Chargement du marché…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.brand}>Stock Market Challenge</Text>
        <Text style={styles.sub}>
          Niv. {portfolio?.level ?? 1}/{portfolio?.maxLevel ?? 10} · Tick {tick}
        </Text>
        {lastEvent ? <Text style={styles.event}>{lastEvent}</Text> : null}
      </View>

      <View style={styles.stats}>
        <Text style={styles.statMain}>{formatEur(portfolio?.totalValue ?? 10000)}</Text>
        <Text
          style={[
            styles.statPnl,
            (portfolio?.totalPnl ?? 0) >= 0 ? styles.up : styles.down,
          ]}
        >
          {(portfolio?.totalPnl ?? 0) >= 0 ? '+' : ''}
          {formatEur(portfolio?.totalPnl ?? 0)} ({(portfolio?.totalPnlPct ?? 0).toFixed(1)}%)
        </Text>
        <Text style={styles.muted}>
          Objectif {formatEur(portfolio?.target ?? 15000)} · Cash {formatEur(portfolio?.cash ?? 0)}
        </Text>
        {portfolio?.canLevelUp ? (
          <Pressable style={styles.levelBtn} onPress={doLevelUp}>
            <Text style={styles.levelBtnText}>Passer au niveau suivant</Text>
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
                        outputRange: ['-8deg', '0deg', '8deg'],
                      }),
                    },
                  ],
                },
              ]}
              {...panResponder.panHandlers}
            >
              <Pressable onPress={openDetail} style={{ flex: 1 }}>
                <Text style={styles.cardSector}>{current.sector.toUpperCase()}</Text>
                <Text style={styles.cardSymbol}>{current.symbol}</Text>
                <Text style={styles.cardName}>{current.name}</Text>
                <Text style={styles.cardPrice}>{formatEur(current.price)}</Text>
                <Text style={styles.hint}>→ Acheter · ← Ignorer · tap détail</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <Text style={styles.muted}>Aucun titre</Text>
          )}
          <View style={styles.row}>
            <Pressable style={[styles.action, styles.skip]} onPress={goNext}>
              <Text style={styles.actionText}>Ignorer</Text>
            </Pressable>
            <Pressable style={[styles.action, styles.tickBtn]} onPress={forceTick}>
              <Text style={styles.actionText}>Tick</Text>
            </Pressable>
            <Pressable style={[styles.action, styles.buy]} onPress={openBuy}>
              <Text style={styles.actionText}>Acheter</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.portfolioList}>
          {(portfolio?.positions ?? []).length === 0 ? (
            <Text style={styles.muted}>Portefeuille vide — swipe pour acheter.</Text>
          ) : (
            portfolio?.positions.map((p) => (
              <View key={p.symbol} style={styles.pos}>
                <View>
                  <Text style={styles.cardSymbol}>{p.symbol}</Text>
                  <Text style={styles.muted}>
                    {p.quantity.toFixed(4)} × {formatEur(p.price)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.cardPrice}>{formatEur(p.marketValue)}</Text>
                  <Text style={p.pnl >= 0 ? styles.up : styles.down}>
                    {p.pnl >= 0 ? '+' : ''}
                    {p.pnlPct.toFixed(1)}%
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === 'market' && styles.tabOn]} onPress={() => setTab('market')}>
          <Text style={styles.tabText}>Marché</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'portfolio' && styles.tabOn]}
          onPress={() => setTab('portfolio')}
        >
          <Text style={styles.tabText}>Portfolio</Text>
        </Pressable>
      </View>

      <Modal visible={buyOpen} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.brand}>Acheter {current?.symbol}</Text>
            <Text style={styles.muted}>Montant en €</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
            <View style={styles.row}>
              <Pressable
                style={[styles.action, styles.skip]}
                onPress={() => {
                  setBuyOpen(false);
                  pan.setValue({ x: 0, y: 0 });
                }}
              >
                <Text style={styles.actionText}>Annuler</Text>
              </Pressable>
              <Pressable style={[styles.action, styles.buy]} onPress={confirmBuy}>
                <Text style={styles.actionText}>Confirmer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={detailOpen} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.brand}>{current?.name}</Text>
            <Text style={styles.cardPrice}>{formatEur(current?.price ?? 0)}</Text>
            <Sparkline data={detailHistory} />
            <Text style={styles.glossaryTitle}>Glossaire</Text>
            {Object.entries(glossary).map(([k, v]) => (
              <Text key={k} style={styles.muted}>
                · {v}
              </Text>
            ))}
            <Pressable style={[styles.action, styles.buy, { marginTop: 16 }]} onPress={() => setDetailOpen(false)}>
              <Text style={styles.actionText}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={tutorial} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.brand}>Bienvenue, trader</Text>
            <Text style={styles.muted}>
              Tu démarres avec 10 000 € fictifs. Swipe à droite pour acheter, à gauche pour passer.
              Objectif niveau 1–10 : atteindre 15 000 €. Aucun risque réel — apprends en jouant.
            </Text>
            <Pressable style={[styles.action, styles.buy, { marginTop: 16 }]} onPress={closeTutorial}>
              <Text style={styles.actionText}>Compris</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3EFE6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3EFE6' },
  header: { paddingHorizontal: 20, paddingTop: 8 },
  brand: { fontSize: 22, fontWeight: '700', color: '#0F3D2E', fontFamily: 'Georgia' },
  sub: { color: '#3D4A44', marginTop: 2 },
  event: { color: '#8A4B08', marginTop: 4, fontSize: 12 },
  stats: { paddingHorizontal: 20, paddingVertical: 12 },
  statMain: { fontSize: 28, fontWeight: '700', color: '#0F3D2E' },
  statPnl: { fontSize: 16, marginTop: 2 },
  up: { color: '#1B7F4A' },
  down: { color: '#B42318' },
  muted: { color: '#5C6B64', marginTop: 4, lineHeight: 20 },
  deck: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  card: {
    width: width - 48,
    minHeight: 280,
    backgroundColor: '#FFFDF8',
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: '#D9D2C3',
    shadowColor: '#0F3D2E',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  cardSector: { color: '#8A4B08', letterSpacing: 1, fontSize: 12, fontWeight: '600' },
  cardSymbol: { fontSize: 36, fontWeight: '700', color: '#0F3D2E', marginTop: 8 },
  cardName: { fontSize: 16, color: '#3D4A44', marginTop: 4 },
  cardPrice: { fontSize: 28, fontWeight: '600', color: '#0F3D2E', marginTop: 24 },
  hint: { marginTop: 'auto', color: '#7A8780', fontSize: 13 },
  row: { flexDirection: 'row', gap: 10, marginTop: 18 },
  action: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  skip: { backgroundColor: '#C4C0B5' },
  buy: { backgroundColor: '#0F3D2E' },
  tickBtn: { backgroundColor: '#8A4B08' },
  actionText: { color: '#FFFDF8', fontWeight: '700' },
  tabs: { flexDirection: 'row', padding: 12, gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#E4DFD3',
    alignItems: 'center',
  },
  tabOn: { backgroundColor: '#0F3D2E' },
  tabText: { color: '#FFFDF8', fontWeight: '600' },
  portfolioList: { padding: 20, gap: 10 },
  pos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFDF8',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9D2C3',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(15,61,46,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#FFFDF8',
    borderRadius: 16,
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D9D2C3',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    fontSize: 18,
  },
  glossaryTitle: { marginTop: 12, fontWeight: '700', color: '#0F3D2E' },
  levelBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#1B7F4A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  levelBtnText: { color: '#FFFDF8', fontWeight: '700' },
});
