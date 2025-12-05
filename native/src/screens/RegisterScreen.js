import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import API from '../api/api';

const AGENCY_CATEGORIES = new Set([
  'agency_state_coordinator',
  'agency_state',
  'agency_district_coordinator',
  'agency_district',
  'agency_pincode_coordinator',
  'agency_pincode',
  'agency_sub_franchise',
]);

const CATEGORIES = [
  { key: 'consumer', label: 'Consumer' },
  { key: 'employee', label: 'Employee' },
  { key: 'business', label: 'Business' },
  { key: 'agency_state_coordinator', label: 'Agency SC' },
  { key: 'agency_state', label: 'Agency State' },
  { key: 'agency_district_coordinator', label: 'Agency DC' },
  { key: 'agency_district', label: 'Agency District' },
  { key: 'agency_pincode_coordinator', label: 'Agency PC' },
  { key: 'agency_pincode', label: 'Agency Pincode' },
  { key: 'agency_sub_franchise', label: 'Agency Sub-Franchise' },
];

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    category: 'consumer',
  });
  const [sponsorId, setSponsorId] = useState('');
  const [pincode, setPincode] = useState('');

  const [geoCountryName, setGeoCountryName] = useState('');
  const [geoStateName, setGeoStateName] = useState('');
  const [geoCityName, setGeoCityName] = useState('');

  const [loading, setLoading] = useState(false);
  const isAgency = useMemo(() => AGENCY_CATEGORIES.has(form.category), [form.category]);

  // Autofill geo from backend pincode lookup (same endpoint naming as web)
  useEffect(() => {
    const pin = (pincode || '').replace(/\D/g, '');
    if (pin.length !== 6) return;
    let stop = false;
    (async () => {
      try {
        const resp = await API.get(`/location/pincode/${pin}/`);
        if (stop) return;
        const payload = resp?.data || {};
        setGeoCityName(payload.city || payload.district || '');
        setGeoStateName(payload.state || '');
        setGeoCountryName(payload.country || '');
      } catch {
        if (stop) return;
        setGeoCityName('');
        setGeoStateName('');
        setGeoCountryName('');
      }
    })();
    return () => {
      stop = true;
    };
  }, [pincode]);

  function setField(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function onSubmit() {
    // Validations aligned with web Register.jsx
    if (!sponsorId.trim()) {
      Alert.alert('Missing', 'Sponsor ID is required.');
      return;
    }
    if ((form.category === 'consumer' || form.category === 'employee') && !form.phone.trim()) {
      Alert.alert('Missing', 'Phone number is required for Consumer and Employee registrations.');
      return;
    }
    if (!form.full_name.trim()) {
      Alert.alert('Missing', 'Full name is required.');
      return;
    }
    if (!form.password) {
      Alert.alert('Missing', 'Password is required.');
      return;
    }

    // NOTE: Advanced agency region assignment (states/districts/pincodes) from the web app
    // is not yet implemented in native UI. Those flows will be added next.
    // Backend may enforce additional fields for agency categories.
    if (isAgency) {
      // Give user a heads-up to avoid confusion if backend rejects the request
      Alert.alert(
        'Agency registration',
        'Basic agency registration is attempted. If backend requires region assignments, please use the web app for now.'
      );
    }

    const payload = {
      email: form.email,
      password: form.password,
      full_name: form.full_name,
      phone: form.phone,
      category: form.category,
      sponsor_id: sponsorId || '',
      pincode,
      country_name: geoCountryName || '',
      country_code: '', // backend endpoint above does not return iso2 in current API
      state_name: geoStateName || '',
      city_name: geoCityName || '',
    };

    try {
      setLoading(true);
      const resp = await API.post('/accounts/register/', payload);
      const data = resp?.data || {};
      const uname = data.username || '(generated)';
      const uid = data.unique_id || '(pending)';
      Alert.alert(
        'Registration successful',
        `Username: ${uname}\nUnique ID: ${uid}\n\nNotes:\n- Consumer login uses TRC + Phone.\n- Employee login uses TRE + Phone.\n- Agency/Business usernames use their category prefix + 6-digit ID.`
      );
      // After success, go back to Login
      navigation.goBack();
    } catch (err) {
      let msg = 'Registration failed.';
      const detail = err?.response?.data;
      if (detail && typeof detail === 'object') {
        try {
          msg += ' ' + JSON.stringify(detail);
        } catch {}
      } else if (err?.message) {
        msg += ' ' + err.message;
      }
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.root}>
          <View style={styles.card}>
            <Text style={styles.title}>Register</Text>

            {/* Category chooser */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
              {CATEGORIES.map((c) => {
                const active = form.category === c.key;
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => setField('category', c.key)}
                    style={[styles.catBtn, active && styles.catBtnActive]}
                  >
                    <Text style={[styles.catText, active && styles.catTextActive]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {isAgency ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteText}>
                  Agency registration may require region assignments (states/districts/pincodes). This simple native form
                  submits the basics. If your backend rejects due to missing region data, please complete registration on
                  the web app. A full native agency flow will be added next.
                </Text>
              </View>
            ) : null}

            <TextInput
              placeholder="Full name"
              value={form.full_name}
              onChangeText={(v) => setField('full_name', v)}
              style={styles.input}
            />
            <TextInput
              placeholder="Email"
              value={form.email}
              onChangeText={(v) => setField('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
            <TextInput
              placeholder="Password"
              value={form.password}
              onChangeText={(v) => setField('password', v)}
              secureTextEntry
              style={styles.input}
            />
            <TextInput
              placeholder={
                form.category === 'consumer' || form.category === 'employee'
                  ? 'Phone (required for Consumer/Employee)'
                  : 'Phone'
              }
              value={form.phone}
              onChangeText={(v) => setField('phone', v)}
              keyboardType="phone-pad"
              style={styles.input}
            />
            <TextInput
              placeholder="Sponsor ID (required)"
              value={sponsorId}
              onChangeText={setSponsorId}
              autoCapitalize="characters"
              style={styles.input}
            />
            <TextInput
              placeholder="Pincode"
              value={pincode}
              onChangeText={setPincode}
              keyboardType="number-pad"
              style={styles.input}
            />

            <View style={styles.geoRow}>
              <View style={styles.geoCol}>
                <Text style={styles.geoLabel}>City</Text>
                <Text style={styles.geoValue}>{geoCityName || '-'}</Text>
              </View>
              <View style={styles.geoCol}>
                <Text style={styles.geoLabel}>State</Text>
                <Text style={styles.geoValue}>{geoStateName || '-'}</Text>
              </View>
              <View style={styles.geoCol}>
                <Text style={styles.geoLabel}>Country</Text>
                <Text style={styles.geoValue}>{geoCountryName || '-'}</Text>
              </View>
            </View>

            <Pressable disabled={loading} onPress={onSubmit} style={[styles.submit, loading && { opacity: 0.7 }]}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Create Account</Text>}
            </Pressable>

            <Pressable onPress={() => navigation.goBack()} style={styles.linkBtn}>
              <Text style={styles.linkText}>Back to Login</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0C2D48',
    textAlign: 'center',
    marginBottom: 12,
  },
  catRow: {
    gap: 8,
    paddingVertical: 4,
    marginBottom: 12,
  },
  catBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    marginRight: 8,
  },
  catBtnActive: {
    borderColor: '#2563eb',
    backgroundColor: '#dbeafe',
  },
  catText: {
    color: '#334155',
    fontWeight: '600',
  },
  catTextActive: {
    color: '#1d4ed8',
  },
  input: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  geoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  geoCol: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
  },
  geoLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  geoValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '700',
  },
  submit: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: {
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  linkBtn: {
    alignItems: 'center',
    marginTop: 12,
  },
  linkText: {
    color: '#2563eb',
    fontWeight: '700',
  },
  noteBox: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  noteText: {
    color: '#9a3412',
  },
});
