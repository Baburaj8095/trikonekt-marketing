import React, { useEffect, useState, useMemo } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../../api/api';

export default function PrimePackageScreen({ navigation }) {
  const [status, setStatus] = useState('non-prime'); // non-prime | partial | active
  const [loading, setLoading] = useState(false);

  // Fetch current status from backend (assigned packages => status), fallback to local
  async function refreshStatus() {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) throw new Error('no token');
      const resp = await API.get('business/agency-packages/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const arr = Array.isArray(resp?.data) ? resp.data : resp?.data?.results || [];
      const statuses = (arr || []).map((a) => String(a.status || '').toLowerCase());
      if (statuses.includes('active')) {
        setStatus('active');
        await AsyncStorage.setItem('agency_prime_status', JSON.stringify({ status: 'active', ts: Date.now() }));
      } else if (statuses.includes('partial')) {
        setStatus('partial');
        await AsyncStorage.setItem('agency_prime_status', JSON.stringify({ status: 'partial', ts: Date.now() }));
      } else {
        // fall back to local
        const raw = await AsyncStorage.getItem('agency_prime_status');
        if (raw) {
          const s = (JSON.parse(raw)?.status || '').toLowerCase();
          if (s === 'active' || s === 'partial' || s === 'non-prime') setStatus(s);
          else setStatus('non-prime');
        } else {
          setStatus('non-prime');
        }
      }
    } catch (e) {
      try {
        const raw = await AsyncStorage.getItem('agency_prime_status');
        if (raw) {
          const s = (JSON.parse(raw)?.status || '').toLowerCase();
          if (s === 'active' || s === 'partial' || s === 'non-prime') setStatus(s);
          else setStatus('non-prime');
        } else {
          setStatus('non-prime');
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  const plans = useMemo(
    () => [
      {
        code: 'BASIC',
        title: 'Basic',
        price: '₹6,000',
        highlight: 'Biomagnetic Bed',
        features: [
          'Agency prime starter benefits',
          'Visibility in agency listings',
          'Priority support (basic)',
        ],
      },
      {
        code: 'STANDARD',
        title: 'Standard',
        price: '₹8,000',
        highlight: 'Water Purifier',
        features: [
          'Everything in Basic',
          'Extended marketplace reach',
          'Priority support (standard)',
        ],
      },
      {
        code: 'PREMIUM',
        title: 'Premium',
        price: '₹15,000',
        highlight: 'TV (32")',
        features: [
          'Everything in Standard',
          'Premium placement & banners',
          'Priority support (premium)',
        ],
      },
    ],
    []
  );

  function badgeForStatus(s) {
    const st = String(s || '').toLowerCase();
    if (st === 'active') return { text: 'Active', bg: '#10b981' };
    if (st === 'partial') return { text: 'Partial Active', bg: '#f59e0b' };
    return { text: 'Non-Prime', bg: '#64748b' };
  }

  const stBadge = badgeForStatus(status);

  async function onBuy(plan) {
    // UI-first flow: mark as "partial" locally so dashboards show status immediately.
    // Real payment capture/API will replace this.
    await AsyncStorage.setItem('agency_prime_status', JSON.stringify({ status: 'partial', plan: plan?.code, ts: Date.now() }));
    setStatus('partial');
    Alert.alert(
      'Purchase Started',
      'Your package is now Partial Active. Once full payment is confirmed by admin, it will be Active.'
    );
  }

  async function onMarkFullPaid() {
    // Temporary helper: mark as active locally
    await AsyncStorage.setItem('agency_prime_status', JSON.stringify({ status: 'active', ts: Date.now() }));
    setStatus('active');
    Alert.alert('Payment Confirmed', 'Your package is now Active.');
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.title}>Agency Prime Package</Text>
      <Text style={styles.subtitle}>
        With Agency Prime Package, sub-franchise can buy packages like ₹6,000 Biomagnetic Bed. For more details see package benefits.
      </Text>

      <View style={[styles.statusPill, { backgroundColor: stBadge.bg }]}>
        <Text style={styles.statusPillText}>{loading ? 'Checking status…' : `Status: ${stBadge.text}`}</Text>
      </View>

      <View style={styles.grid}>
        {plans.map((p) => (
          <View key={p.code} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{p.title}</Text>
              <Text style={styles.cardPrice}>{p.price}</Text>
            </View>
            <Text style={styles.cardHighlight}>{p.highlight}</Text>
            <View style={styles.divider} />
            <View style={{ gap: 6 }}>
              {p.features.map((f, idx) => (
                <Text key={idx} style={styles.feature}>
                  • {f}
                </Text>
              ))}
            </View>
            <Pressable style={styles.buyBtn} onPress={() => onBuy(p)}>
              <Text style={styles.buyBtnText}>BUY NOW</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={{ height: 12 }} />

      <Pressable style={styles.secondaryBtn} onPress={refreshStatus}>
        <Text style={styles.secondaryBtnText}>Refresh Status</Text>
      </Pressable>

      {/* Temporary helper to demo full-payment transition until agency-side payment API is added */}
      <Pressable style={[styles.secondaryBtn, { marginTop: 8 }]} onPress={onMarkFullPaid}>
        <Text style={styles.secondaryBtnText}>I have completed full payment</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 6,
    color: '#334155',
  },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillText: {
    color: '#fff',
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  card: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    color: '#f97316',
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  cardPrice: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  cardHighlight: {
    textAlign: 'center',
    color: '#475569',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 8,
  },
  feature: {
    color: '#0f172a',
  },
  buyBtn: {
    marginTop: 12,
    backgroundColor: '#f97316',
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  buyBtnText: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: '#94a3b8',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#0f172a',
    fontWeight: '700',
  },
});
