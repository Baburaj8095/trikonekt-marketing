import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { listStoreProducts } from '../../api/api';

function Item({ item, onPress }) {
  return (
    <Pressable
      onPress={() => onPress?.(item)}
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
      <Text style={{ fontWeight: '800', color: '#111827' }}>{item?.name || item?.title || 'Product'}</Text>
      {item?.description ? (
        <Text style={{ marginTop: 6, color: '#475569' }} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}
      {item?.price ? (
        <Text style={{ marginTop: 8, color: '#0f172a', fontWeight: '700' }}>₹ {item.price}</Text>
      ) : null}
    </Pressable>
  );
}

export default function MarketplaceScreen() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await listStoreProducts();
      const items = Array.isArray(res?.results) ? res.results : Array.isArray(res) ? res : [];
      setData(items);
    } catch (e) {
      setError('Failed to load products');
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

  const onPressItem = (item) => {
    // TODO: navigate to details when native details screen exists
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 8, color: '#334155', fontWeight: '600' }}>Loading products…</Text>
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
      data={data}
      keyExtractor={(it, idx) => String(it?.id || idx)}
      renderItem={({ item }) => <Item item={item} onPress={onPressItem} />}
      contentContainerStyle={{ paddingVertical: 8 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ color: '#334155' }}>No products available.</Text>
        </View>
      }
    />
  );
}
