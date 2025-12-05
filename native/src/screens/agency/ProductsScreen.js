import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import API from '../../api/api';

function ProductRow({ item, onPress }) {
  const name = item?.name || item?.title || 'Product';
  const price = item?.price ?? item?.amount ?? null;
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
      <Text style={{ fontWeight: '800', color: '#111827' }}>{name}</Text>
      {item?.description ? (
        <Text style={{ marginTop: 6, color: '#475569' }} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}
      {price != null ? (
        <Text style={{ marginTop: 8, color: '#0f172a', fontWeight: '700' }}>₹ {price}</Text>
      ) : null}
    </Pressable>
  );
}

export default function ProductsScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await API.get('coupons/store/products/', { params: { mine: true } });
      const list = Array.isArray(res?.data?.results)
        ? res.data.results
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];
      setItems(list);
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
    // TODO: navigate to edit/details when native forms are added
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
      data={items}
      keyExtractor={(it, idx) => String(it?.id ?? idx)}
      renderItem={({ item }) => <ProductRow item={item} onPress={onPressItem} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingVertical: 8 }}
      ListEmptyComponent={
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ color: '#334155' }}>No products found.</Text>
        </View>
      }
    />
  );
}
