import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import API from '../../api/api';

function Stat({ label, value, color = '#0f172a' }) {
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
        marginBottom: 8,
      }}
    >
      <Text style={{ color: '#64748b', fontWeight: '700' }}>{label}</Text>
      <Text style={{ marginTop: 6, color, fontWeight: '900', fontSize: 18 }}>{value}</Text>
    </View>
  );
}

function MemberRow({ item }) {
  const username = item?.username || '-';
  const category = item?.category || '-';
  const role = item?.role || '-';
  const joined = item?.date_joined || '';
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
      <Text style={{ fontWeight: '800', color: '#111827' }}>{username}</Text>
      <Text style={{ marginTop: 2, color: '#334155' }}>Category: {category}</Text>
      <Text style={{ marginTop: 2, color: '#334155' }}>Role: {role}</Text>
      {joined ? <Text style={{ marginTop: 2, color: '#64748b' }}>{joined}</Text> : null}
    </View>
  );
}

export default function MyTeamScreen() {
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const res = await API.get('accounts/team/summary/');
      const data = res?.data || res || {};
      setSummary(data);
      const arr = Array.isArray(data?.recent_team) ? data.recent_team : [];
      setRecent(arr);
    } catch (e) {
      setError('Failed to load team summary.');
      setSummary(null);
      setRecent([]);
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
        <Text style={{ marginTop: 8, color: '#334155', fontWeight: '600' }}>Loading team…</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={recent}
      keyExtractor={(it, idx) => String(it?.id ?? idx)}
      renderItem={({ item }) => <MemberRow item={item} />}
      ListHeaderComponent={
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#0C2D48' }}>My Team</Text>
          {error ? (
            <Text style={{ marginTop: 6, color: '#b91c1c', fontWeight: '700' }}>{error}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
            <Stat label="Direct Downline" value={summary?.downline?.direct ?? 0} color="#2563eb" />
            <Stat
              label="Direct Referral Commission"
              value={summary?.totals?.direct_referral ?? 0}
              color="#16a34a"
            />
          </View>
          <Text style={{ marginTop: 12, marginBottom: 4, color: '#0f172a', fontWeight: '800' }}>
            Recent Team Members
          </Text>
        </View>
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ color: '#334155' }}>No recent members.</Text>
        </View>
      }
      contentContainerStyle={{ paddingBottom: 12 }}
    />
  );
}
