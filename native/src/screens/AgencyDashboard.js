import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api/api';

export default function AgencyDashboard({ navigation }) {
  const [me, setMe] = useState(null);
  const [primeStatus, setPrimeStatus] = useState('non-prime');
  const isSubFranchise = String(me?.category || '').toLowerCase() === 'agency_sub_franchise';

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('user');
        if (raw) {
          try { setMe(JSON.parse(raw)); } catch {}
        }
        const token = await AsyncStorage.getItem('token');
        if (token) {
          const resp = await API.get('accounts/me/', { headers: { Authorization: `Bearer ${token}` } });
          setMe(resp?.data || resp);
          await AsyncStorage.setItem('user', JSON.stringify(resp?.data || resp));
        }
      } catch (e) {}
    })();
  }, []);
  
  useEffect(() => {
    async function loadStatus() {
      try {
        const isSF = String(me?.category || '').toLowerCase() === 'agency_sub_franchise';
        if (!isSF) return;
        const token = await AsyncStorage.getItem('token');
        if (!token) return;
        const resp = await API.get('business/agency-packages/', { headers: { Authorization: `Bearer ${token}` } });
        const arr = Array.isArray(resp?.data) ? resp.data : resp?.data?.results || [];
        const statuses = (arr || []).map(a => String(a.status || '').toLowerCase());
        if (statuses.includes('active')) setPrimeStatus('active');
        else if (statuses.includes('partial')) setPrimeStatus('partial');
        else setPrimeStatus('non-prime');
      } catch (e) {
        // Fallback to local flag set by PrimePackageScreen (UI-only)
        try {
          const raw = await AsyncStorage.getItem('agency_prime_status');
          if (raw) {
            const s = (JSON.parse(raw)?.status || '').toLowerCase();
            if (s === 'active' || s === 'partial' || s === 'non-prime') setPrimeStatus(s);
          }
        } catch {}
      }
    }
    loadStatus();
  }, [me]);
  
  function onAction(name) {
    Alert.alert('Not implemented', `${name} is coming soon in the native app.`);
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.title}>Welcome{me?.full_name ? `, ${me.full_name}` : ''}</Text>
      <Text style={styles.subtitle}>Agency Dashboard</Text>

      <View style={styles.grid}>
        <Pressable style={styles.card} onPress={() => onAction('Marketplace')}>
          <Text style={styles.cardTitle}>Marketplace</Text>
          <Text style={styles.cardDesc}>Agency marketplace</Text>
        </Pressable>

        <Pressable style={styles.card} onPress={() => navigation?.navigate('AgencyPrimePackage')}>
          <Text style={styles.cardTitle}>Prime Package Buy</Text>
          <Text style={styles.cardDesc}>
            Prime Package Buy with Agency Prime Package agency user can buy can prime package of agency selecting 6k bigomegantic bed for more details see agency prime package
          </Text>
        </Pressable>

        <Pressable style={styles.card} onPress={() => onAction('Products')}>
          <Text style={styles.cardTitle}>Products</Text>
          <Text style={styles.cardDesc}>Manage products/catalog</Text>
        </Pressable>

        <Pressable style={styles.card} onPress={() => onAction('Banners')}>
          <Text style={styles.cardTitle}>Banners</Text>
          <Text style={styles.cardDesc}>Manage promotional banners</Text>
        </Pressable>

        <Pressable style={styles.card} onPress={() => onAction('Orders')}>
          <Text style={styles.cardTitle}>Orders</Text>
          <Text style={styles.cardDesc}>View and fulfill orders</Text>
        </Pressable>

        <Pressable style={styles.card} onPress={() => onAction('Purchase Requests')}>
          <Text style={styles.cardTitle}>Purchase Requests</Text>
          <Text style={styles.cardDesc}>Handle incoming requests</Text>
        </Pressable>

        <Pressable style={styles.card} onPress={() => onAction('Reports')}>
          <Text style={styles.cardTitle}>Reports</Text>
          <Text style={styles.cardDesc}>Daily/summary reports</Text>
        </Pressable>

      </View>
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
    marginTop: 4,
    color: '#334155',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  cardDesc: {
    color: '#475569',
  },
});
