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

  // Nominees state
  const [nominees, setNominees] = useState([]);
  const [loadingNominees, setLoadingNominees] = useState(true);
  const [savingNominee, setSavingNominee] = useState(false);
  const [nomineeError, setNomineeError] = useState('');
  const [nomineeMsg, setNomineeMsg] = useState('');
  const [nomineeForm, setNomineeForm] = useState({
    name: '',
    relationship: '',
    phone: '',
    share_percent: '',
  });

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

  const loadNominees = useCallback(async () => {
    try {
      setLoadingNominees(true);
      setNomineeError('');
      setNomineeMsg('');
      const res = await API.get('accounts/nominees/');
      const arr = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setNominees(arr);
    } catch (e) {
      setNomineeError('Failed to load nominees.');
    } finally {
      setLoadingNominees(false);
    }
  }, []);

  useEffect(() => {
    loadKYC();
    loadNominees();
  }, [loadKYC, loadNominees]);

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

  // Nominee helpers
  const validateNominee = useCallback(() => {
    const n = (nomineeForm.name || '').trim();
    const r = (nomineeForm.relationship || '').trim();
    const p = String(nomineeForm.phone || '').replace(/[^0-9]/g, '');
    const s = String(nomineeForm.share_percent || '').trim();
    if (!n) {
      setNomineeError('Nominee name is required.');
      return false;
    }
    if (!r) {
      setNomineeError('Relationship is required.');
      return false;
    }
    if (!p || p.length < 10) {
      setNomineeError('Enter a valid 10-digit phone for nominee.');
      return false;
    }
    const sp = Number(s);
    if (!Number.isFinite(sp) || sp < 0 || sp > 100) {
      setNomineeError('Share percent must be between 0 and 100.');
      return false;
    }
    setNomineeError('');
    return true;
  }, [nomineeForm]);

  const onSaveNominee = useCallback(async () => {
    if (!validateNominee()) return;
    try {
      setSavingNominee(true);
      setNomineeMsg('');
      const payload = {
        name: String(nomineeForm.name || '').trim(),
        relationship: String(nomineeForm.relationship || '').trim(),
        phone: String(nomineeForm.phone || '').replace(/[^0-9]/g, ''),
        share_percent: Number(nomineeForm.share_percent || 0),
      };
      await API.post('accounts/nominees/', payload);
      setNomineeForm({ name: '', relationship: '', phone: '', share_percent: '' });
      setNomineeMsg('Nominee saved.');
      await loadNominees();
      Alert.alert('Success', 'Nominee saved.');
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        (err?.response?.data ? JSON.stringify(err.response.data) : 'Failed to save nominee.');
      setNomineeError(String(msg));
      Alert.alert('Error', String(msg));
    } finally {
      setSavingNominee(false);
    }
  }, [nomineeForm, validateNominee, loadNominees]);

  const onDeleteNominee = useCallback(async (id) => {
    try {
      await API.delete(`accounts/nominees/${id}/`);
      await loadNominees();
    } catch (e) {
      Alert.alert('Error', 'Failed to delete nominee.');
    }
  }, [loadNominees]);

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

      {/* Nominees Section */}
      <View style={{ height: 1, backgroundColor: '#e5e7eb', marginVertical: 16 }} />
      <Text style={{ fontSize: 18, fontWeight: '800', color: '#0C2D48', marginBottom: 8 }}>Nominee Details</Text>
      <Text style={{ color: '#64748b', marginBottom: 10 }}>
        Add nominee details. These are saved to your profile.
      </Text>

      {nomineeMsg ? (
        <Text style={{ backgroundColor: '#ecfdf5', color: '#065f46', padding: 10, borderRadius: 8, marginBottom: 8 }}>
          {nomineeMsg}
        </Text>
      ) : null}
      {nomineeError ? (
        <Text style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 8, marginBottom: 8 }}>
          {nomineeError}
        </Text>
      ) : null}

      <View style={{ marginBottom: 10 }}>
        <Text style={{ color: '#334155', marginBottom: 6 }}>Name</Text>
        <TextInput
          value={nomineeForm.name}
          onChangeText={(t) => setNomineeForm((f) => ({ ...f, name: t }))}
          placeholder="Nominee full name"
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
        <Text style={{ color: '#334155', marginBottom: 6 }}>Relationship</Text>
        <TextInput
          value={nomineeForm.relationship}
          onChangeText={(t) => setNomineeForm((f) => ({ ...f, relationship: t }))}
          placeholder="e.g., Father, Mother, Spouse"
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
        <Text style={{ color: '#334155', marginBottom: 6 }}>Nominee Phone</Text>
        <TextInput
          value={nomineeForm.phone}
          onChangeText={(t) => setNomineeForm((f) => ({ ...f, phone: t.replace(/[^0-9]/g, '') }))}
          placeholder="10-digit phone"
          keyboardType="number-pad"
          maxLength={10}
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
        <Text style={{ color: '#334155', marginBottom: 6 }}>Share Percent (%)</Text>
        <TextInput
          value={String(nomineeForm.share_percent)}
          onChangeText={(t) => {
            // allow only digits, clamp 0-100
            const n = t.replace(/[^0-9]/g, '');
            setNomineeForm((f) => ({ ...f, share_percent: n }));
          }}
          placeholder="e.g., 100"
          keyboardType="number-pad"
          maxLength={3}
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

      <Pressable
        onPress={onSaveNominee}
        disabled={savingNominee}
        style={({ pressed }) => ({
          backgroundColor: savingNominee ? '#9ca3af' : '#16a34a',
          paddingVertical: 12,
          borderRadius: 10,
          alignItems: 'center',
          opacity: pressed ? 0.9 : 1,
          marginTop: 6,
          marginBottom: 12,
        })}
      >
        <Text style={{ color: '#fff', fontWeight: '800' }}>{savingNominee ? 'Saving...' : 'Save Nominee'}</Text>
      </Pressable>

      <Text style={{ fontSize: 16, fontWeight: '700', color: '#0C2D48', marginBottom: 8 }}>My Nominees</Text>
      {loadingNominees ? (
        <View style={{ paddingVertical: 8 }}>
          <ActivityIndicator size="small" color="#2563eb" />
        </View>
      ) : nominees && nominees.length ? (
        nominees.map((n) => (
          <View
            key={n.id}
            style={{
              backgroundColor: '#fff',
              borderColor: '#e2e8f0',
              borderWidth: 1,
              borderRadius: 10,
              padding: 12,
              marginBottom: 10,
            }}
          >
            <Text style={{ color: '#0f172a', fontWeight: '700' }}>{n.name} • {n.relationship}</Text>
            <Text style={{ color: '#334155', marginTop: 2 }}>Phone: {n.phone || '-'}</Text>
            <Text style={{ color: '#334155' }}>Share: {n.share_percent != null ? `${n.share_percent}%` : '-'}</Text>
            <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
              <Pressable
                onPress={() => onDeleteNominee(n.id)}
                style={({ pressed }) => ({
                  backgroundColor: '#ef4444',
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))
      ) : (
        <Text style={{ color: '#64748b' }}>No nominees added yet.</Text>
      )}
    </ScrollView>
  );
}
