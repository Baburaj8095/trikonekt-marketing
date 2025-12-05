import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API, { fetchMe, saveSession, getAPIBase } from '../api/api';

function prettyRole(r) {
  const map = { user: 'Consumer', agency: 'Agency', employee: 'Employee', business: 'Merchant' };
  return map[String(r || '').toLowerCase()] || String(r || '');
}

async function resolveRegisteredRole(uname) {
  try {
    const r = await API.get('/accounts/hierarchy/', { params: { username: String(uname || '').trim() } });
    const u = r?.data?.user || r?.data || {};
    let ro = (u?.role || '').toLowerCase();
    if (!ro) {
      const c = (u?.category || '').toLowerCase();
      if (c.startsWith('agency')) ro = 'agency';
      else if (c === 'consumer') ro = 'user';
      else if (c === 'employee') ro = 'employee';
      else if (c === 'business') ro = 'business';
    }
    return ro || null;
  } catch {
    return null;
  }
}

export default function LoginScreen({ navigation }) {
  // Tabs + role
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [role, setRole] = useState('user'); // user | agency | employee | business
  const isLogin = mode === 'login';

  // Login form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const passRef = useRef(null);

  // Forgot password modal
  const [fpOpen, setFpOpen] = useState(false);
  const [fpUsername, setFpUsername] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpLoading, setFpLoading] = useState(false);

  // Load remembered username
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('remember_username');
        if (saved) {
          setUsername(saved);
          setRemember(true);
        }
      } catch {}
    })();
  }, []);

  // Forgot password submit
  async function onPasswordReset() {
    const uname = (fpUsername || username || '').trim();
    const newPass = fpNewPassword;
    if (!uname || !newPass) {
      Alert.alert('Missing', 'Provide both username and new password.');
      return;
    }
    try {
      setFpLoading(true);
      const res = await API.post('/accounts/password/reset/', {
        username: uname,
        new_password: newPass,
      });
      Alert.alert('Success', res?.data?.detail || 'Password reset successful.');
      setFpOpen(false);
      setFpUsername('');
      setFpNewPassword('');
    } catch (err) {
      const msg = err?.response?.data?.detail || (err?.response?.data ? JSON.stringify(err.response.data) : 'Password reset failed');
      Alert.alert('Error', String(msg));
    } finally {
      setFpLoading(false);
    }
  }

  async function onSubmit() {
    if (!isLogin) {
      navigation.navigate('Register');
      return;
    }
    if (!username || !password) {
      Alert.alert('Missing fields', 'Enter username and password');
      return;
    }
    let abortTimeout;
    try {
      setLoading(true);

      abortTimeout = setTimeout(() => {
        try {
          const base = getAPIBase?.() || 'n/a';
          Alert.alert(
            'Network timeout',
            `No response from API. Check EXPO_PUBLIC_API_URL and connectivity.\n\nCurrent base: ${base}`
          );
        } catch {}
        setLoading(false);
      }, 15000);

      // Preflight role check with 6s cap to avoid hanging
      const resolved = await Promise.race([
        resolveRegisteredRole(username),
        new Promise((r) => setTimeout(() => r(null), 6000)),
      ]);
      if (resolved && resolved !== role) {
        Alert.alert('Role mismatch', `You are registered as ${prettyRole(resolved)} but trying to login as ${prettyRole(role)}.`);
        setLoading(false);
        return;
      }

      const res = await API.post('/accounts/login/', {
        username: String(username).trim(),
        password,
        role,
      });
      const data = res?.data || {};
      const access = data?.access || data?.token || data?.data?.token;
      const refresh = data?.refresh || null;
      if (!access) throw new Error('No access token returned from server');

      // Fetch profile with fresh token
      let me = null;
      try {
        me = await fetchMe(access);
      } catch {}

      // Save session (uses secure/native stores inside helper)
      await saveSession({ access, refresh, user: me || { username, role } });

      // Remember username if requested
      try {
        if (remember) await AsyncStorage.setItem('remember_username', String(username));
        else await AsyncStorage.removeItem('remember_username');
      } catch {}

      // Admin route not supported in native
      if (me?.is_staff || me?.is_superuser) {
        Alert.alert('Not supported', 'Admin login is not supported in the native app.');
        setLoading(false);
        return;
      }

      // Decide navigation role
      let navRole = String(me?.role || me?.category || '').toLowerCase();
      if (!navRole) {
        navRole = role; // fallback to selected role
      }

      if (navRole.startsWith('agency')) {
        navigation.reset({ index: 0, routes: [{ name: 'Agency' }] });
      } else if (navRole.startsWith('employee')) {
        navigation.reset({ index: 0, routes: [{ name: 'Employee' }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'Consumer' }] });
      }
    } catch (e) {
      const isTimeout = e?.code === 'ECONNABORTED' || /timeout/i.test(e?.message || '');
      const isNet = isTimeout || e?.message?.toLowerCase?.().includes('network') || e?.code === 'ERR_NETWORK';
      if (isNet) {
        try {
          const base = getAPIBase?.() || 'n/a';
          Alert.alert(
            'Network error',
            `Cannot reach API. Set EXPO_PUBLIC_API_URL in native/.env to a reachable base and restart Expo.\n\nCurrent base: ${base}`
          );
        } catch (_) {
          Alert.alert('Network error', 'Cannot reach API. Set EXPO_PUBLIC_API_URL in native/.env and restart Expo.');
        }
      } else {
        const data = e?.response?.data;
        if (data?.multiple_accounts && Array.isArray(data.multiple_accounts)) {
          const choices = data.multiple_accounts.map((a) => a.username).join(', ');
          Alert.alert('Multiple accounts', `Please enter one of these usernames: ${choices}`);
        } else {
          const msg = data?.detail || (data ? JSON.stringify(data) : e.message || 'Login failed');
          Alert.alert('Login failed', String(msg));
        }
      }
    } finally {
      if (abortTimeout) clearTimeout(abortTimeout);
      setLoading(false);
    }
  }

  const roles = [
    { key: 'user', label: 'Consumer' },
    { key: 'agency', label: 'Agency' },
    { key: 'employee', label: 'Employee' },
    { key: 'business', label: 'Merchant' },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.root}>
          <View style={styles.card}>
            <Text style={styles.logo}>TRIKONEKT</Text>

            {/* Tabs */}
            <View style={styles.tabsRow}>
              <Pressable onPress={() => setMode('login')} style={[styles.tabBtn, mode === 'login' && styles.tabBtnActive]}>
                <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>Login</Text>
              </Pressable>
              <Pressable onPress={() => { setMode('register'); navigation.navigate('Register'); }} style={[styles.tabBtn, mode === 'register' && styles.tabBtnActive]}>
                <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>Register</Text>
              </Pressable>
            </View>

            {/* Roles */}
            <View style={styles.roleRow}>
              {roles.map((r) => (
                <Pressable
                  key={r.key}
                  onPress={() => setRole(r.key)}
                  style={[styles.roleBtn, role === r.key && styles.roleBtnActive]}
                >
                  <Text style={[styles.roleText, role === r.key && styles.roleTextActive]}>{r.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Login fields */}
            {isLogin ? (
              <>
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder='Username'
                  autoCapitalize='none'
                  returnKeyType='next'
                  style={styles.input}
                  onSubmitEditing={() => passRef.current?.focus?.()}
                />
                <View>
                  <TextInput
                    ref={passRef}
                    value={password}
                    onChangeText={setPassword}
                    placeholder='Password'
                    secureTextEntry={!passwordVisible}
                    style={styles.input}
                    returnKeyType='done'
                    onSubmitEditing={onSubmit}
                  />
                  <Pressable onPress={() => setPasswordVisible((v) => !v)} style={styles.eyeBtn}>
                    <Text style={styles.eyeText}>{passwordVisible ? 'Hide' : 'Show'}</Text>
                  </Pressable>
                </View>
                <View style={styles.rowBetween}>
                  <View style={styles.rememberRow}>
                    <Switch value={remember} onValueChange={setRemember} />
                    <Text style={styles.rememberText}>Remember me</Text>
                  </View>
                  <Pressable onPress={() => setFpOpen(true)}>
                    <Text style={styles.linkText}>Forgot password?</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.noteText}>Create your account in the native app.</Text>
                <Text style={[styles.noteText, { textAlign: 'center' }]}>Tap REGISTER below to continue.</Text>
              </>
            )}

            <Pressable disabled={loading} onPress={onSubmit} style={[styles.submit, loading && { opacity: 0.7 }]}>
              <Text style={styles.submitText}>{loading ? 'Please wait...' : isLogin ? 'LOGIN' : 'REGISTER'}</Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>© {new Date().getFullYear()} Trikonekt. All rights reserved.</Text>
            <Text style={styles.footerText}>Contact: contact@trikonekt.com</Text>
          </View>
        </View>
      </ScrollView>

      {/* Forgot Password Modal */}
      <Modal visible={fpOpen} transparent animationType='fade' onRequestClose={() => setFpOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <TextInput
              value={fpUsername}
              onChangeText={setFpUsername}
              placeholder='Username'
              autoCapitalize='none'
              style={styles.input}
            />
            <TextInput
              value={fpNewPassword}
              onChangeText={setFpNewPassword}
              placeholder='New Password'
              secureTextEntry
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setFpOpen(false)} style={[styles.modalBtn, styles.modalCancel]}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable disabled={fpLoading} onPress={onPasswordReset} style={[styles.modalBtn, styles.modalPrimary, fpLoading && { opacity: 0.8 }]}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>{fpLoading ? 'Resetting...' : 'Reset Password'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    maxWidth: 420,
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
  logo: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0C2D48',
    textAlign: 'center',
    marginBottom: 12,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#e0f2fe',
    borderColor: '#0284c7',
  },
  tabText: {
    fontWeight: '700',
    color: '#334155',
  },
  tabTextActive: {
    color: '#0369a1',
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    justifyContent: 'center',
  },
  roleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    margin: 4,
  },
  roleBtnActive: {
    borderColor: '#16a34a',
    backgroundColor: '#dcfce7',
  },
  roleText: {
    color: '#334155',
    fontWeight: '600',
  },
  roleTextActive: {
    color: '#166534',
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
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 10,
    padding: 6,
  },
  eyeText: {
    color: '#2563eb',
    fontWeight: '700',
  },
  rowBetween: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rememberText: {
    color: '#334155',
    fontWeight: '500',
  },
  linkText: {
    color: '#2563eb',
    fontWeight: '700',
  },
  noteText: {
    color: '#475569',
    marginBottom: 8,
    textAlign: 'center',
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
  footer: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    marginTop: 12,
  },
  footerText: {
    color: '#0f172a',
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalCancel: {
    borderColor: '#cbd5e1',
  },
  modalPrimary: {
    borderColor: '#2563eb',
    backgroundColor: '#2563eb',
  },
  modalBtnText: {
    color: '#0f172a',
    fontWeight: '700',
  },
});
