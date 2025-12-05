import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import API from '../../api/api';

function fmtAmount(v) {
  const n = Number(v || 0);
  return n.toFixed(2);
}

function TxRow({ tx }) {
  const created = tx?.created_at ? new Date(tx.created_at).toLocaleString() : '-';
  const amount = Number(tx?.commission ?? tx?.amount ?? 0);
  const positive = amount >= 0;
  const type = (tx?.type || 'TX').toString().replace(/_/g, ' ');
  const balAfter = tx?.balance_after ?? 0;

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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '800', color: '#111827' }}>{type}</Text>
        <Text style={{ fontWeight: '800', color: positive ? '#16a34a' : '#b91c1c' }}>
          {positive ? '+' : '-'}₹ {fmtAmount(Math.abs(amount))}
        </Text>
      </View>
      <Text style={{ marginTop: 4, color: '#334155' }}>{tx?.source_type || '-'}</Text>
      <View style={{ marginTop: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: '#64748b' }}>{created}</Text>
        <Text style={{ color: '#64748b' }}>Bal: ₹ {fmtAmount(balAfter)}</Text>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const PAGE_SIZE = 20;

  const loadPage = useCallback(
    async (pageNum = 1, append = false) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        setError('');
        const res = await API.get('accounts/wallet/me/transactions/', {
          params: { page: pageNum, page_size: PAGE_SIZE },
        });
        const data = res?.data || {};
        const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
        const count = typeof data?.count === 'number' ? data.count : undefined;
        setItems((prev) => (append ? [...prev, ...list] : list));
        if (typeof count === 'number') {
          setHasMore((append ? items.length + list.length : list.length) < count);
        } else {
          setHasMore(list.length === PAGE_SIZE);
        }
        setPage(pageNum);
      } catch (e) {
        setError('Failed to load transactions');
        if (!append) setItems([]);
      } finally {
        if (append) setLoadingMore(false);
        else {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [items.length]
  );

  useEffect(() => {
    loadPage(1, false);
  }, [loadPage]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPage(1, false);
  }, [loadPage]);

  const onEndReached = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      loadPage(page + 1, true);
    }
  }, [loading, loadingMore, hasMore, page, loadPage]);

  if (loading && !refreshing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 8, color: '#334155', fontWeight: '600' }}>Loading history…</Text>
      </View>
    );
  }

  if (error && items.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ color: '#b91c1c', fontWeight: '700' }}>{error}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(it, idx) => String(it?.id ?? idx)}
      renderItem={({ item }) => <TxRow tx={item} />}
      contentContainerStyle={{ paddingVertical: 8 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      onEndReachedThreshold={0.2}
      onEndReached={onEndReached}
      ListFooterComponent={
        loadingMore ? (
          <View style={{ padding: 12, alignItems: 'center' }}>
            <ActivityIndicator color="#2563eb" />
          </View>
        ) : null
      }
      ListEmptyComponent={
        !loading && items.length === 0 ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: '#334155' }}>No transactions found.</Text>
          </View>
        ) : null
      }
    />
  );
}
