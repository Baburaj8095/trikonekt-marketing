import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { getMyEcouponOrders } from '../../api/api';

function OrderRow({ item }) {
  const id = item?.id ?? item?.pk ?? '';
  const status = item?.status || item?.state || 'pending';
  const qty = item?.quantity ?? item?.qty ?? '-';
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
      <Text style={{ fontWeight: '800', color: '#111827' }}>Order #{id}</Text>
      <Text style={{ marginTop: 4, color: '#334155' }}>Status: {String(status).toUpperCase()}</Text>
      <Text style={{ marginTop: 2, color: '#334155' }}>Quantity: {qty}</Text>
      {created ? <Text style={{ marginTop: 2, color: '#64748b' }}>{created}</Text> : null}
    </View>
  );
}

export default function MyOrdersScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await getMyEcouponOrders();
      const items = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
      setOrders(items);
    } catch (e) {
      setError('Failed to load orders');
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
        <Text style={{ marginTop: 8, color: '#334155', fontWeight: '600' }}>Loading orders…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ color: '#b91c1c', fontWeight: '700' }}>{error}</Text>
        <Pressable onPress={load} style={{ marginTop: 12, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#2563eb', borderRadius: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={orders}
      keyExtractor={(it, idx) => String(it?.id ?? it?.pk ?? idx)}
      renderItem={({ item }) => <OrderRow item={item} />}
      contentContainerStyle={{ paddingVertical: 8 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ color: '#334155' }}>No orders yet.</Text>
        </View>
      }
    />
  );
}
