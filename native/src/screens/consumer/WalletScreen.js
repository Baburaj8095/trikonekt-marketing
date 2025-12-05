import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { getMyECouponSummary, getMyECoupons } from '../../api/api';

function SummaryCard({ label, value, color = '#0f172a' }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginRight: 8,
      }}
    >
      <Text style={{ color: '#64748b', fontWeight: '700' }}>{label}</Text>
      <Text style={{ marginTop: 6, color, fontWeight: '800', fontSize: 18 }}>{value}</Text>
    </View>
  );
}

function CodeRow({ item }) {
  const code = item?.code || item?.coupon_code || item?.number || '-';
  const status = (item?.status || item?.state || 'active').toString().toUpperCase();
  const created = item?.created_at || item?.created || item?.date || '';

  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginHorizontal: 12,
        marginVertical: 6,
      }}
    >
      <Text style={{ fontWeight: '800', color: '#111827' }}>{code}</Text>
      <Text style={{ marginTop: 4, color: '#334155' }}>Status: {status}</Text>
      {created ? <Text style={{ marginTop: 2, color: '#64748b' }}>{created}</Text> : null}
    </View>
  );
}

export default function WalletScreen() {
  const [summary, setSummary] = useState({ total: 0, available: 0, used: 0 });
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sum, list] = await Promise.all([getMyECouponSummary(), getMyECoupons()]);
      const s = sum || {};
      setSummary({
        total: s?.total ?? s?.count ?? 0,
        available: s?.available ?? s?.balance ?? 0,
        used: s?.used ?? s?.redeemed ?? 0,
      });
      const items = Array.isArray(list?.results) ? list.results : Array.isArray(list) ? list : [];
      setCodes(items);
    } catch (e) {
      // fail silently; keep previous state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 8, color: '#334155', fontWeight: '600' }}>Loading wallet…</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={codes}
      keyExtractor={(it, idx) => String(it?.id ?? it?.pk ?? it?.code ?? idx)}
      renderItem={({ item }) => <CodeRow item={item} />}
      ListHeaderComponent={
        <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 }}>
          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            <SummaryCard label="Total" value={summary.total} />
            <SummaryCard label="Available" value={summary.available} color="#16a34a" />
            <SummaryCard label="Used" value={summary.used} color="#b91c1c" />
          </View>
          <Text style={{ marginTop: 8, marginBottom: 4, marginLeft: 2, color: '#0f172a', fontWeight: '800' }}>
            My E‑Coupons
          </Text>
        </View>
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ color: '#334155' }}>No coupon codes found.</Text>
        </View>
      }
      contentContainerStyle={{ paddingBottom: 12 }}
    />
  );
}
