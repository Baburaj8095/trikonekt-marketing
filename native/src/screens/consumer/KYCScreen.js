import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, ScrollView } from 'react-native';
import API from '../../api/api';

export default function KYCScreen() {
  const [form, setForm] = useState({
    bank_name: '',
    bank_account_number: '',
    ifsc_code: '',
  });
  const [meta, setMeta] = useState({
    verified: false,
    verified_at: null,
    updated_at: null,
    can_submit_kyc: true,
    kyc_reopen_allowed: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const locked = meta.verified && !meta.can_submit_kyc;

  const validate = useCallback(() => {
    const { bank_name, bank_account_number, ifsc_code } = form;
    if (!String(bank_name || '').trim()) {
      setError('Bank name is required.');
      return false;
    }
    const acc = String(bank_account_number || '').trim();
    if (!acc || acc.length < 6) {
      setError('Enter a valid bank account number.');
      return false;
    }
    const ifsc = String(ifsc_code || '').trim().toUpperCase();
    const ifscRe = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
    if (!ifscRe.test(ifsc)) {
      setError('Enter a valid IFSC code (e.g., HDFC0001234).');
      return false;
    }
    setError('');
    return true;
  }, [form]);

  const loadKYC = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setMessage('');
      const res = await API.get('accounts/kyc/me/');
      const data = res?.data || res || {};
      setForm({
        bank_name: data.bank_name || '',
        bank_account_number: data.bank_account_number || '',
        ifsc_code: data.ifsc_code || '',
      });
      setMeta({
        verified: !!data?.verified,
        verified_at: data?.verified_at || null,
        updated_at: data?.updated_at || null,
        can_submit_kyc: data?.can_submit_kyc !== undefined ? !!data.can_submit_kyc : !data?.verified,
        kyc_reopen_allowed: !!data?.kyc_reopen_allowed,
      });
    } catch (e) {
      setError('Failed to load KYC details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKYC();
  }, [loadKYC]);

  const onSubmit = useCallback(async () => {
    if (!validate()) return;
    if (meta.verified && !meta.can_submit_kyc) {
      setError('KYC is verified and locked. Please contact Support for re-verification.');
      return;
    }
    try {
      setSaving(true);
      setMessage('');
      const payload = {
        bank_name: String(form.bank_name || '').trim(),
        bank_account_number: String(form.bank_account_number || '').trim(),
        ifsc_code: String(form.ifsc_code || '').trim().toUpperCase(),
      };
      const res = await API.put('accounts/kyc/me/', payload);
      const data = res?.data || res || {};
      setMessage('KYC details saved.');
      setMeta({
        verified: !!data?.verified,
        verified_at: data?.verified_at || null,
        updated_at: data?.updated_at || null,
        can_submit_kyc: data?.can_submit_kyc !== undefined ? !!data.can_submit_kyc : !data?.verified,
        kyc_reopen_allowed: !!data?.kyc_reopen_allowed,
      });
      Alert.alert('Success', 'KYC details saved.');
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        (err?.response?.data ? JSON.stringify(err.response.data) : 'Failed to save KYC.');
      setError(String(msg));
      Alert.alert('Error', String(msg));
    } finally {
      setSaving(false);
    }
  }, [form, meta, validate]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 8, color: '#334155', fontWeight: '600' }}>Loading KYC…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: '#0C2D48', marginBottom: 12 }}>Bank KYC</Text>

      {meta.verified ? (
        <Text style={{ backgroundColor: '#ecfdf5', color: '#065f46', padding: 10, borderRadius: 8, marginBottom: 8 }}>
          KYC verified{meta.verified_at ? ` on ${new Date(meta.verified_at).toLocaleString()}` : ''}.
        </Text>
      ) : (
        <Text style={{ backgroundColor: '#eff6ff', color: '#1e3a8a', padding: 10, borderRadius: 8, marginBottom: 8 }}>
          KYC pending verification. Please ensure your details are correct.
        </Text>
      )}

      {message ? (
        <Text style={{ backgroundColor: '#ecfdf5', color: '#065f46', padding: 10, borderRadius: 8, marginBottom: 8 }}>
          {message}
        </Text>
      ) : null}
      {error ? (
        <Text style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 8, marginBottom: 8 }}>
          {error}
        </Text>
      ) : null}
      {locked ? (
        <Text style={{ backgroundColor: '#fffbeb', color: '#92400e', padding: 10, borderRadius: 8, marginBottom: 8 }}>
          Your KYC is verified and locked. To modify details, raise a request in Support.
        </Text>
      ) : null}

      <View style={{ marginBottom: 10 }}>
        <Text style={{ color: '#334155', marginBottom: 6 }}>Bank Name</Text>
        <TextInput
          value={form.bank_name}
          onChangeText={(t) => setForm((f) => ({ ...f, bank_name: t }))}
          placeholder="Enter bank name"
          style={{
            backgroundColor: '#fff',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        />
      </View>

      <View style={{ marginBottom: 10 }}>
        <Text style={{ color: '#334155', marginBottom: 6 }}>Bank Account Number</Text>
        <TextInput
          value={form.bank_account_number}
          onChangeText={(t) => setForm((f) => ({ ...f, bank_account_number: t.replace(/[^0-9]/g, '') }))}
          placeholder="Enter account number"
          keyboardType="number-pad"
          style={{
            backgroundColor: '#fff',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        />
      </View>

      <View style={{ marginBottom: 10 }}>
        <Text style={{ color: '#334155', marginBottom: 6 }}>IFSC Code</Text>
        <TextInput
          value={form.ifsc_code}
          onChangeText={(t) => setForm((f) => ({ ...f, ifsc_code: t.toUpperCase() }))}
          placeholder="HDFC0001234"
          autoCapitalize="characters"
          maxLength={11}
          style={{
            backgroundColor: '#fff',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            textTransform: 'uppercase',
          }}
        />
      </View>

      <Pressable
        onPress={onSubmit}
        disabled={saving || loading || locked}
        style={({ pressed }) => ({
          backgroundColor: saving || loading || locked ? '#9ca3af' : '#145DA0',
          paddingVertical: 12,
          borderRadius: 10,
          alignItems: 'center',
          opacity: pressed ? 0.9 : 1,
          marginTop: 6,
        })}
      >
        <Text style={{ color: '#fff', fontWeight: '800' }}>{saving ? 'Saving...' : 'Save KYC'}</Text>
      </Pressable>

      {meta.updated_at ? (
        <Text style={{ marginTop: 8, color: '#64748b' }}>
          Last updated: {new Date(meta.updated_at).toLocaleString()}
        </Text>
      ) : null}
    </ScrollView>
  );
}
