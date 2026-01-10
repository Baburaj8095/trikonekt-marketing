import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, ScrollView } from 'react-native';
import API, { getMyECouponSummary } from '../../api/api';

function Chip({ label, value, bg = '#f8fafc', color = '#0f172a' }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: bg,
        borderColor: '#e2e8f0',
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: '#64748b', fontWeight: '700' }}>{label}</Text>
      <Text style={{ marginTop: 6, color, fontWeight: '900', fontSize: 18 }}>{value}</Text>
    </View>
  );
}

export default function ECouponScreen() {
  const [summary, setSummary] = useState({ available: 0, redeemed: 0, activated: 0, transferred: 0 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [couponType, setCouponType] = useState('150'); // '150' | '50'
  const [action, setAction] = useState('ACTIVATE'); // 'ACTIVATE' | 'REDEEM'
  const [couponCode, setCouponCode] = useState('');
  const [referralId, setReferralId] = useState('');

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      const s = await getMyECouponSummary();
      const d = s || {};
      setSummary({
        available: d.available ?? 0,
        redeemed: d.redeemed ?? 0,
        activated: d.activated ?? 0,
        transferred: d.transferred ?? 0,
      });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const validate = () => {
    if (!couponCode.trim()) {
      Alert.alert('Validation', 'Coupon Code is required.');
      return false;
    }
    if (!referralId.trim()) {
      Alert.alert('Validation', 'TR Referral ID is required.');
      return false;
    }
    if (action === 'REDEEM' && couponType === '50') {
      Alert.alert('Validation', '₹50 coupon cannot be redeemed. Choose Activate.');
      return false;
    }
    return true;
  };

  const onSubmit = useCallback(async () => {
    if (!validate()) return;
    try {
      setSubmitting(true);
      if (action === 'ACTIVATE') {
        const t = couponType === '50' ? '50' : '150';
        await API.post('v1/coupon/activate/?async=1', {
          type: t,
          source: {
            channel: 'e_coupon',
            code: couponCode.trim(),
            referral_id: referralId.trim(),
          },
        });
        Alert.alert('Success', t === '150' ? 'Activated: 5-matrix + 3-matrix opened.' : 'Activated: 3-matrix opened.');
      } else {
        await API.post('v1/coupon/redeem/', {
          type: '150',
          source: {
            channel: 'e_coupon',
            code: couponCode.trim(),
            referral_id: referralId.trim(),
          },
        });
        Alert.alert('Success', 'Redeem successful. Wallet will be credited.');
      }
      setCouponCode('');
      await loadSummary();
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        (err?.response?.data ? JSON.stringify(err.response.data) : 'Request failed');
      Alert.alert('Error', String(msg));
    } finally {
      setSubmitting(false);
    }
  }, [action, couponType, couponCode, referralId, loadSummary]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 8, color: '#334155', fontWeight: '600' }}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: '#0C2D48', marginBottom: 12 }}>E‑Coupon Actions</Text>

      {/* Summary chips */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Chip label="Available" value={summary.available} bg="#7c3aed" color="#fff" />
        <Chip label="Redeemed" value={summary.redeemed} bg="#e11d48" color="#fff" />
        <Chip label="Activated" value={summary.activated} bg="#059669" color="#fff" />
        <Chip label="Transferred" value={summary.transferred} bg="#0ea5e9" color="#fff" />
      </View>

      {/* Controls */}
      <Text style={{ marginTop: 16, color: '#0f172a', fontWeight: '800' }}>Select Coupon Type</Text>
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        {['150', '50'].map((t) => {
          const selected = couponType === t;
          return (
            <Pressable
              key={t}
              onPress={() => setCouponType(t)}
              style={({ pressed }) => ({
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 8,
                marginRight: 8,
                backgroundColor: selected ? '#2563eb' : '#fff',
                borderWidth: 1,
                borderColor: '#e2e8f0',
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ color: selected ? '#fff' : '#0f172a', fontWeight: '800' }}>₹{t}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ marginTop: 16, color: '#0f172a', fontWeight: '800' }}>Select Action</Text>
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        {['ACTIVATE', 'REDEEM'].map((a) => {
          const disabled = a === 'REDEEM' && couponType === '50';
          const selected = action === a;
          return (
            <Pressable
              key={a}
              onPress={() => !disabled && setAction(a)}
              disabled={disabled}
              style={({ pressed }) => ({
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 8,
                marginRight: 8,
                backgroundColor: disabled ? '#e5e7eb' : selected ? '#2563eb' : '#fff',
                borderWidth: 1,
                borderColor: '#e2e8f0',
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ color: disabled ? '#9ca3af' : selected ? '#fff' : '#0f172a', fontWeight: '800' }}>
                {a === 'ACTIVATE' ? 'Activate' : 'Redeem'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: 16 }}>
        <Text style={{ color: '#334155', marginBottom: 6 }}>Coupon Code</Text>
        <TextInput
          value={couponCode}
          onChangeText={setCouponCode}
          placeholder="Enter coupon code"
          autoCapitalize="characters"
          style={styles.input}
        />
      </View>

      <View style={{ marginTop: 10 }}>
        <Text style={{ color: '#334155', marginBottom: 6 }}>TR Referral ID</Text>
        <TextInput
          value={referralId}
          onChangeText={setReferralId}
          placeholder="Enter TR referral ID"
          autoCapitalize="characters"
          style={styles.input}
        />
      </View>

      <Pressable
        onPress={onSubmit}
        disabled={submitting}
        style={({ pressed }) => ({
          backgroundColor: submitting ? '#9ca3af' : '#145DA0',
          paddingVertical: 12,
          borderRadius: 10,
          alignItems: 'center',
          opacity: pressed ? 0.9 : 1,
          marginTop: 12,
        })}
      >
        <Text style={{ color: '#fff', fontWeight: '800' }}>{submitting ? 'Processing…' : 'Submit'}</Text>
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
