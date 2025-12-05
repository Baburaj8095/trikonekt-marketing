import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api/api';

export default function EmployeeDashboard() {
  const [me, setMe] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        // Load cached user first
        const raw = await AsyncStorage.getItem('user');
        if (raw) {
          try { setMe(JSON.parse(raw)); } catch {}
        }
        // Refresh from backend if token exists
        const token = await AsyncStorage.getItem('token');
        if (token) {
          const resp = await API.get('accounts/me/', { headers: { Authorization: `Bearer ${token}` } });
          setMe(resp?.data || resp);
          await AsyncStorage.setItem('user', JSON.stringify(resp?.data || resp));
        }
      } catch (e) {}
    })();
  }, []);

  function onAction(name) {
    Alert.alert('Not implemented', `${name} is coming soon in the native app.`);
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.title}>Welcome{me?.full_name ? `, ${me.full_name}` : ''}</Text>
      <Text style={styles.subtitle}>Employee Dashboard</Text>

      <View style={styles.grid}>
        <Pressable style={styles.card} onPress={() => onAction('Daily Report')}>
          <Text style={styles.cardTitle}>Daily Report</Text>
          <Text style={styles.cardDesc}>View or submit daily activity</Text>
        </Pressable>

        <Pressable style={styles.card} onPress={() => onAction('Targets')}>
          <Text style={styles.cardTitle}>Targets</Text>
          <Text style={styles.cardDesc}>Track rewards & targets</Text>
        </Pressable>

        <Pressable style={styles.card} onPress={() => onAction('Orders')}>
          <Text style={styles.cardTitle}>Orders</Text>
          <Text style={styles.cardDesc}>Manage assigned orders</Text>
        </Pressable>

        <Pressable style={styles.card} onPress={() => onAction('Support')}>
          <Text style={styles.cardTitle}>Support</Text>
          <Text style={styles.cardDesc}>Raise or resolve tickets</Text>
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
