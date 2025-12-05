import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Share, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAPIBase } from '../../api/api';

function ActionButton({ title, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: disabled ? '#9ca3af' : '#2563eb',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        opacity: pressed ? 0.9 : 1,
        marginRight: 8,
        marginBottom: 8,
      })}
    >
      <Text style={{ color: '#fff', fontWeight: '800' }}>{title}</Text>
    </Pressable>
  );
}

export default function ReferEarnScreen() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [sponsorId, setSponsorId] = useState('');
  const [role, setRole] = useState('');

  const origin = (() => {
    // Prefer explicit webapp URL when provided
    const fromEnv =
      (typeof process !== 'undefined' &&
        process.env &&
        (process.env.EXPO_PUBLIC_WEBAPP_URL || process.env.WEBAPP_URL)) ||
      '';
    if (fromEnv) return fromEnv.replace(/\/$/, '');
    try {
      const base = getAPIBase() || '';
      // Trim trailing /api for web app host
      return base.replace(/\/api\/?$/, '');
    } catch {
      return '';
    }
  })();

  const buildLink = useCallback(
    (roleParam, extra = {}) => {
      const params = new URLSearchParams({
        mode: 'register',
        role: roleParam,
        ...(sponsorId ? { sponsor: sponsorId } : {}),
        ...extra,
      });
      const base = origin || '';
      return `${base}/login?${params.toString()}`;
    },
    [origin, sponsorId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [uStr, rUser, rAgency, rEmp, rGeneric] = await Promise.all([
        AsyncStorage.getItem('user'),
        AsyncStorage.getItem('role_user'),
        AsyncStorage.getItem('role_agency'),
        AsyncStorage.getItem('role_employee'),
        AsyncStorage.getItem('role'),
      ]);

      let u = null;
      try {
        u = uStr ? JSON.parse(uStr) : null;
      } catch {
        u = null;
      }
      setUser(u);

      const r =
        (rEmp || rAgency || rUser || rGeneric || (u?.role || u?.role_name) || '').toString().toLowerCase();
      setRole(r);

      const sponsor =
        u?.sponsor_id ||
        u?.prefixed_id ||
        u?.username ||
        '';
      setSponsorId(String(sponsor || '').trim());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const share = async (label, link) => {
    const idText = sponsorId ? `Sponsor ID: ${sponsorId}\n` : '';
    const text = `Join me on Trikonekt.\n${idText}Use this ${label} registration link:\n${link}`;
    try {
      await Share.share({ title: 'Refer & Earn', message: text });
    } catch (e) {
      Alert.alert('Share failed', 'Unable to open share dialog.');
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 8, color: '#334155', fontWeight: '600' }}>Loading…</Text>
      </View>
    );
  }

  const consumerLink = buildLink('user');
  const employeeLink = buildLink('employee');
  const subFranchiseLink = buildLink('agency', { agency_level: 'sub_franchise' });
  const merchantLink = buildLink('business');

  const isEmployee = role === 'employee';
  const isAgency = role === 'agency';
  // Sub-franchise users should see employee + sub-franchise too
  const showEmployee = isEmployee || isAgency;
  const showSubFranchise = isEmployee || isAgency;
  const showMerchant = isEmployee || isAgency;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: '#0C2D48' }}>Refer & Earn</Text>
      <Text style={{ marginTop: 6, color: '#475569' }}>
        Share these links. New registrations will auto-fill your Sponsor ID.
      </Text>

      <View style={{ marginTop: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
        <Text style={{ color: '#334155', fontWeight: '800', marginBottom: 8 }}>Share Links</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <ActionButton title="Share Consumer" onPress={() => share('Consumer', consumerLink)} />
          {showEmployee ? (
            <ActionButton
              title="Share Employee"
              onPress={() => sponsorId ? share('Employee', employeeLink) : Alert.alert('Missing Sponsor', 'Sponsor ID missing. Re-login required.')}
            />
          ) : null}
          {showSubFranchise ? (
            <ActionButton
              title="Share Sub‑Franchise"
              onPress={() => sponsorId ? share('Sub‑Franchise', subFranchiseLink) : Alert.alert('Missing Sponsor', 'Sponsor ID missing. Re-login required.')}
            />
          ) : null}
          {showMerchant ? (
            <ActionButton
              title="Share Merchant"
              onPress={() => sponsorId ? share('Merchant', merchantLink) : Alert.alert('Missing Sponsor', 'Sponsor ID missing. Re-login required.')}
            />
          ) : null}
        </View>

        <View style={{ marginTop: 8 }}>
          <Text style={{ color: '#64748b' }}>
            {sponsorId ? `Sponsor ID: ${sponsorId}` : 'Sponsor ID not available'}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 12 }}>
        <Text style={{ color: '#334155', fontWeight: '800' }}>Notes</Text>
        <Text style={{ color: '#64748b', marginTop: 4 }}>
          You can configure the web app host via EXPO_PUBLIC_WEBAPP_URL in native/.env to generate links that open in the browser.
        </Text>
      </View>
    </ScrollView>
  );
}
