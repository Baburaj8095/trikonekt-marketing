import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../../api/api';

export default function ProfileScreen() {
  const [form, setForm] = useState({
    email: '',
    phone: '',
    age: '',
    pincode: '',
    address: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const load = useCallback(async () => {
    setErr('');
    setOk('');
    try {
      setLoading(true);
      const res = await API.get('accounts/profile/');
      const d = res?.data || res || {};
      setForm({
        email: d.email || '',
        phone: d.phone || '',
        age: d.age === null || d.age === undefined ? '' : String(d.age),
        pincode: d.pincode || '',
        address: d.address || '',
      });
    } catch (e) {
      setErr('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSave = useCallback(async () => {
    setErr('');
    setOk('');
    setSaving(true);
    try {
      const payload = {
        email: form.email,
        phone: form.phone,
        age: form.age === '' ? '' : String(form.age),
        pincode: form.pincode,
        address: form.address,
      };
      await API.patch('accounts/profile/', payload);
      setOk('Profile updated successfully.');

      // Refresh cached user in AsyncStorage (best-effort)
      try {
        const me = await API.get('accounts/me/');
        const data = me?.data || me || {};
        await AsyncStorage.setItem('user', JSON.stringify(data));
      } catch {}
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === 'string' ? e.response.data : '') ||
        'Failed to update profile.';
      setErr(String(msg));
      Alert.alert('Error', String(msg));
    } finally {
      setSaving(false);
    }
  }, [form]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 8, color: '#334155', fontWeight: '600' }}>Loading profile…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 12 }}>My Profile</Text>

      {err ? (
        <Text style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 8, marginBottom: 8 }}>
          {err}
        </Text>
      ) : null}
      {ok ? (
        <Text style={{ backgroundColor: '#ecfdf5', color: '#065f46', padding: 10, borderRadius: 8, marginBottom: 8 }}>
          {ok}
        </Text>
      ) : null}

      <View style={{ marginBottom: 10 }}>
        <Text style={{ color: '#334155', marginBottom: 6 }}>Email</Text>
        <TextInput
          value={form.email}
          onChangeText={(t) => setForm((f) => ({ ...f, email: t }))}
          placeholder="mail@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />
      </View>

      <View style={{ marginBottom: 10 }}>
        <Text style={{ color: '#334155', marginBottom: 6 }}>Phone</Text>
        <TextInput
          value={form.phone}
          onChangeText={(t) => setForm((f) => ({ ...f, phone: t.replace(/[^0-9]/g, '').slice(0, 10) }))}
          placeholder="10-digit phone"
          keyboardType="number-pad"
          style={styles.input}
        />
      </View>

      <View style={{ marginBottom: 10 }}>
        <Text style={{ color: '#334155', marginBottom: 6 }}>Age</Text>
        <TextInput
          value={form.age}
          onChangeText={(t) => setForm((f) => ({ ...f, age: t.replace(/[^0-9]/g, '').slice(0, 3) }))}
          placeholder="e.g. 28"
          keyboardType="number-pad"
          style={styles.input}
        />
      </View>

      <View style={{ marginBottom: 10 }}>
        <Text style={{ color: '#334155', marginBottom: 6 }}>Pincode</Text>
        <TextInput
          value={form.pincode}
          onChangeText={(t) => setForm((f) => ({ ...f, pincode: t.replace(/[^0-9]/g, '').slice(0, 6) }))}
          placeholder="6-digit pincode"
          keyboardType="number-pad"
          style={styles.input}
        />
      </View>

      <View style={{ marginBottom: 10 }}>
        <Text style={{ color: '#334155', marginBottom: 6 }}>Address (optional)</Text>
        <TextInput
          value={form.address}
          onChangeText={(t) => setForm((f) => ({ ...f, address: t }))}
          placeholder="Your address"
          multiline
          numberOfLines={3}
          style={[styles.input, { textAlignVertical: 'top', minHeight: 80 }]}
        />
      </View>

      <Pressable
        onPress={onSave}
        disabled={saving}
        style={({ pressed }) => ({
          backgroundColor: saving ? '#9ca3af' : '#145DA0',
          paddingVertical: 12,
          borderRadius: 10,
          alignItems: 'center',
          opacity: pressed ? 0.9 : 1,
          marginTop: 6,
        })}
      >
        <Text style={{ color: '#fff', fontWeight: '800' }}>{saving ? 'Saving…' : 'Save'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = {
  input: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
};
