import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  FlatList,
  Alert,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API, { getAPIBase } from '../api/api';

function KpiCard({ title, value, subtitle, palette = 'blue', onPress }) {
  const pal = paletteStyles(palette);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.kpiCard,
        {
          backgroundColor: pal.bg,
          borderColor: pal.border,
          shadowColor: '#000',
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Text style={[styles.kpiTitle, { color: pal.text }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[styles.kpiValue, { color: pal.text }]} numberOfLines={1}>
        {value}
      </Text>
      {subtitle ? (
        <Text style={[styles.kpiSub, { color: pal.sub }]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

function paletteStyles(key) {
  switch (key) {
    case 'indigo':
      return {
        bg: '#4f46e5',
        border: 'rgba(99,102,241,0.35)',
        text: '#fff',
        sub: 'rgba(255,255,255,0.9)',
      };
    case 'blue':
      return {
        bg: '#3b82f6',
        border: 'rgba(59,130,246,0.35)',
        text: '#fff',
        sub: 'rgba(255,255,255,0.9)',
      };
    case 'green':
      return {
        bg: '#10b981',
        border: 'rgba(16,185,129,0.35)',
        text: '#fff',
        sub: 'rgba(255,255,255,0.9)',
      };
    case 'red':
      return {
        bg: '#ef4444',
        border: 'rgba(239,68,68,0.35)',
        text: '#fff',
        sub: 'rgba(255,255,255,0.9)',
      };
    case 'purple':
      return {
        bg: '#8b5cf6',
        border: 'rgba(139,92,246,0.35)',
        text: '#fff',
        sub: 'rgba(255,255,255,0.9)',
      };
    case 'cyan':
      return {
        bg: '#06b6d4',
        border: 'rgba(6,182,212,0.35)',
        text: '#fff',
        sub: 'rgba(255,255,255,0.9)',
      };
    case 'amber':
      return {
        bg: '#f59e0b',
        border: 'rgba(245,158,11,0.35)',
        text: '#0f172a',
        sub: 'rgba(15,23,42,0.75)',
      };
    case 'teal':
      return {
        bg: '#14b8a6',
        border: 'rgba(20,184,166,0.35)',
        text: '#0f172a',
        sub: 'rgba(15,23,42,0.75)',
      };
    default:
      return {
        bg: '#ffffff',
        border: '#e2e8f0',
        text: '#0f172a',
        sub: '#64748b',
      };
  }
}

function SummaryChip({ label, value, colors }) {
  const [bg, text] = colors || ['#f8fafc', '#0f172a'];
  return (
    <View style={[styles.summaryChip, { backgroundColor: bg, borderColor: '#e2e8f0' }]}>
      <Text style={[styles.summaryLabel]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: text }]}>{value}</Text>
    </View>
  );
}

function ProductCard({ card, mediaBase }) {
  const image =
    card?.image && String(card.image).startsWith('http')
      ? card.image
      : card?.image
      ? `${mediaBase}${card.image}`
      : null;
  return (
    <View style={styles.prodCard}>
      {image ? (
        <Image source={{ uri: image }} style={styles.prodImage} resizeMode="cover" />
      ) : (
        <View style={[styles.prodImage, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#64748b' }}>No image</Text>
        </View>
      )}
      <View style={{ padding: 10 }}>
        <Text style={styles.prodTitle} numberOfLines={1}>
          {card?.title || 'Product'}
        </Text>
        {card?.description ? (
          <Text style={styles.prodDesc} numberOfLines={2}>
            {card.description}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function ConsumerDashboard({ navigation }) {
  const [me, setMe] = useState(null);
  const displayName = useMemo(() => {
    return me?.full_name || me?.username || 'Consumer';
  }, [me]);
  const myReferralId = useMemo(() => {
    return me?.prefixed_id || me?.username || '-';
  }, [me]);

  // KPI states
  const [wallet, setWallet] = useState({ balance: '0' });
  const [referralCommissionTotal, setReferralCommissionTotal] = useState(0);
  const [walletDirectReferralTotal, setWalletDirectReferralTotal] = useState(0);
  const [ecSummary, setEcSummary] = useState(null);
  const [activation, setActivation] = useState(null);
  const [referralCount, setReferralCount] = useState(0);

  // Cards (admin-managed)
  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(true);

  // Loading flags
  const [loadingAll, setLoadingAll] = useState(true);

  const mediaBase = useMemo(() => {
    try {
      const base = getAPIBase() || '';
      return base.replace(/\/api\/?$/, '');
    } catch {
      return '';
    }
  }, []);

  const accountActive = Boolean(activation?.active);
  const accountStatusStr = accountActive ? 'Active' : 'Inactive';
  const accountPalette = accountActive ? 'green' : 'red';

  const loadMe = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('user');
      if (raw) {
        try {
          setMe(JSON.parse(raw));
        } catch {}
      }
      const token = await AsyncStorage.getItem('token');
      if (token) {
        const resp = await API.get('accounts/me/', { headers: { Authorization: `Bearer ${token}` } });
        const data = resp?.data || resp;
        setMe(data);
        await AsyncStorage.setItem('user', JSON.stringify(data));
      }
    } catch {}
  }, []);

  const loadWallet = useCallback(async () => {
    try {
      const res = await API.get('accounts/wallet/me/');
      setWallet({ balance: res?.data?.balance ?? '0' });
    } catch {
      setWallet({ balance: '0' });
    }
  }, []);

  const loadCodesSummary = useCallback(async () => {
    try {
      const res = await API.get('coupons/codes/consumer-summary/');
      setEcSummary(res?.data || null);
    } catch {
      setEcSummary(null);
    }
  }, []);

  const loadCommissions = useCallback(async () => {
    try {
      const res = await API.get('coupons/commissions/mine/');
      const arr = Array.isArray(res?.data) ? res.data : res?.data?.results || [];
      const valid = (arr || []).filter((c) =>
        ['earned', 'paid'].includes(String(c.status || '').toLowerCase())
      );
      const referral = valid.filter((c) => !c.coupon_code || !String(c.coupon_code).trim());
      const total = referral.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
      setReferralCommissionTotal(total);
    } catch {
      setReferralCommissionTotal(0);
    }
  }, []);

  const loadTeamSummary = useCallback(async () => {
    try {
      const res = await API.get('accounts/team/summary/');
      const totals = res?.data?.totals || {};
      const valStr = totals?.direct_referral ?? '0';
      setWalletDirectReferralTotal(Number(valStr) || 0);
      const direct = res?.data?.downline?.direct ?? 0;
      setReferralCount(Number(direct) || 0);
    } catch {
      setWalletDirectReferralTotal(0);
      setReferralCount(0);
    }
  }, []);

  const loadActivation = useCallback(async () => {
    try {
      const res = await API.get('business/activation/status/');
      setActivation(res?.data || {});
    } catch {
      setActivation(null);
    }
  }, []);

  const loadCards = useCallback(async () => {
    try {
      setLoadingCards(true);
      const res = await API.get('uploads/cards/', { params: { role: 'consumer' } });
      const data = Array.isArray(res?.data) ? res.data : res?.data?.results || [];
      setCards((data || []).filter((c) => c.is_active !== false));
    } catch {
      setCards([]);
    } finally {
      setLoadingCards(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoadingAll(true);
    await Promise.all([
      loadMe(),
      loadWallet(),
      loadCodesSummary(),
      loadCommissions(),
      loadTeamSummary(),
      loadActivation(),
      loadCards(),
    ]);
    setLoadingAll(false);
  }, [loadMe, loadWallet, loadCodesSummary, loadCommissions, loadTeamSummary, loadActivation, loadCards]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function onSelf50Activation() {
    try {
      await API.post('business/activations/self-50/', {});
      await Promise.all([loadWallet(), loadActivation()]);
      Alert.alert('Success', '50 activation triggered successfully.');
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to activate.';
      Alert.alert('Error', String(msg));
    }
  }

  if (loadingAll && !me) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.centerText}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      {/* Banner */}
      <View style={styles.banner}>
        <View style={{ position: 'absolute', bottom: 16, left: 16 }}>
          <Text style={styles.bannerTitle}>Welcome, {displayName}</Text>
          <Text style={styles.bannerSub}>Explore offers, redeem coupons and more</Text>
        </View>
      </View>

      {/* KPI grid */}
      <View style={styles.grid}>
        <KpiCard
          title="Account Status"
          value={accountStatusStr}
          subtitle={accountActive ? 'Autopool enabled' : 'Inactive account'}
          palette={accountPalette}
        />
        <KpiCard
          title="Wallet Balance"
          value={`₹${wallet.balance}`}
          subtitle="Go to Wallet"
          palette="cyan"
          onPress={() => navigation?.navigate?.('Wallet')}
        />
        <KpiCard
          title="Coupon Commission"
          value={`₹${referralCommissionTotal.toFixed(2)}`}
          subtitle="Coupon commissions"
          palette="green"
        />
        <KpiCard
          title="Direct Referral Commission"
          value={`₹${walletDirectReferralTotal.toFixed(2)}`}
          subtitle="From direct referrals"
          palette="green"
        />
        <KpiCard
          title="E‑Coupons Available"
          value={ecSummary?.available ?? 0}
          subtitle={`Redeemed: ${ecSummary?.redeemed ?? 0}`}
          palette="purple"
          onPress={() => (navigation?.getParent?.()?.navigate?.('ECoupon')) || navigation?.navigate?.('ECoupon')}
        />
        <KpiCard
          title="Marketplace"
          value="Open"
          subtitle="Explore products"
          palette="blue"
          onPress={() => navigation?.navigate?.('Marketplace')}
        />
        <KpiCard
          title="My Orders"
          value="View"
          subtitle="Track purchases"
          palette="teal"
          onPress={() => navigation?.navigate?.('Orders')}
        />
        <KpiCard
          title="KYC"
          value="Start"
          subtitle="Complete your KYC"
          palette="amber"
          onPress={() => (navigation?.getParent?.()?.navigate?.('KYC')) || navigation?.navigate?.('KYC')}
        />
        <KpiCard
          title="My Team"
          value={String(referralCount)}
          subtitle="Direct referrals"
          palette="indigo"
          onPress={() => (navigation?.getParent?.()?.navigate?.('MyTeam')) || navigation?.navigate?.('MyTeam')}
        />
        <KpiCard
          title="My Referral ID"
          value={myReferralId}
          subtitle="Share this ID to refer"
          palette="teal"
          onPress={() => (navigation?.getParent?.()?.navigate?.('ReferEarn')) || navigation?.navigate?.('ReferEarn')}
        />
        <KpiCard
          title="Self 50 Activation"
          value="Run"
          subtitle="Trigger now"
          palette="red"
          onPress={onSelf50Activation}
        />
      </View>

      {/* E‑Coupon Summary */}
      <View style={styles.cardSection}>
        <Text style={styles.sectionTitle}>My E‑Coupon Summary</Text>
        <View style={styles.summaryRow}>
          <SummaryChip label="Available" value={ecSummary?.available ?? 0} colors={['#7c3aed', '#fff']} />
          <SummaryChip label="Redeemed" value={ecSummary?.redeemed ?? 0} colors={['#e11d48', '#fff']} />
          <SummaryChip label="Activated" value={ecSummary?.activated ?? 0} colors={['#059669', '#fff']} />
          <SummaryChip label="Transferred" value={ecSummary?.transferred ?? 0} colors={['#0ea5e9', '#fff']} />
        </View>
      </View>

      {/* Marketplace Cards (admin-managed) */}
      <View style={styles.cardSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Agency Products</Text>
          <Pressable
            onPress={() => navigation?.navigate?.('Marketplace')}
            style={styles.actionBtn}
          >
            <Text style={styles.actionBtnText}>Marketplace</Text>
          </Pressable>
        </View>
        {loadingCards ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator color="#2563eb" />
            <Text style={styles.centerText}>Loading cards…</Text>
          </View>
        ) : (
          <FlatList
            data={cards}
            keyExtractor={(it, idx) => String(it?.id || idx)}
            renderItem={({ item }) => <ProductCard card={item} mediaBase={mediaBase} />}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 4 }}
            ListEmptyComponent={
              <View style={{ padding: 12 }}>
                <Text style={{ color: '#64748b' }}>No cards available.</Text>
              </View>
            }
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    padding: 16,
    backgroundColor: '#f7f9fb',
  },
  banner: {
    position: 'relative',
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#0C2D48',
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  bannerSub: {
    marginTop: 4,
    color: '#e2e8f0',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  kpiCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  kpiTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    opacity: 0.95,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 12,
    marginTop: 4,
  },
  cardSection: {
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionTitle: {
    fontWeight: '800',
    color: '#0C2D48',
  },
  actionBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  summaryChip: {
    flexGrow: 1,
    minWidth: '48%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  summaryLabel: {
    color: '#e5e7eb',
    fontWeight: '700',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    marginTop: 6,
  },
  prodCard: {
    width: 220,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginHorizontal: 6,
    overflow: 'hidden',
  },
  prodImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f8fafc',
  },
  prodTitle: {
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  prodDesc: {
    color: '#475569',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  centerText: {
    marginTop: 8,
    color: '#334155',
    fontWeight: '600',
  },
});
