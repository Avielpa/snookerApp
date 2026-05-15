// components/AuthCard.tsx
// Small modal card for login / register / logout.
// Opened by the account button in Header.tsx.

import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { syncOnLogin } from '../../services/scoreboardSyncService';

type Tab = 'login' | 'register';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AuthCard({ visible, onClose }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { user, loggedIn, doLogin, doRegister, doLogout } = useAuth();

  const [tab, setTab] = useState<Tab>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function resetForm() {
    setUsername('');
    setPassword('');
    setEmail('');
    setError('');
  }

  function close() {
    resetForm();
    onClose();
  }

  async function handleSubmit() {
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.');
      return;
    }
    if (tab === 'register' && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (tab === 'login') {
        await doLogin(username.trim(), password);
      } else {
        await doRegister(username.trim(), password, email.trim());
      }
      // Sync scoreboard history after login — fire-and-forget
      syncOnLogin().catch(() => {});
      close();
    } catch (e: any) {
      const detail = e?.response?.data?.detail
        || e?.response?.data?.username?.[0]
        || e?.response?.data?.password?.[0]
        || e?.message
        || 'Something went wrong.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await doLogout();
    close();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <TouchableWithoutFeedback onPress={close}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={[styles.card, { backgroundColor: c.cardBackground, borderColor: c.cardBorder }]}>

                {loggedIn && user ? (
                  /* ── Logged-in state ──────────────────────────────── */
                  <>
                    <Text style={[styles.heading, { color: c.textHeader }]}>Account</Text>
                    <Text style={[styles.username, { color: c.textPrimary }]}>👤 {user.username}</Text>
                    {!!user.email && (
                      <Text style={[styles.meta, { color: c.textMuted }]}>{user.email}</Text>
                    )}
                    <Text style={[styles.syncNote, { color: c.textSecondary }]}>
                      Your match history syncs automatically across devices.
                    </Text>
                    <TouchableOpacity
                      style={[styles.btn, { backgroundColor: '#CC0000' }]}
                      onPress={handleLogout}
                    >
                      <Text style={styles.btnText}>Log out</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  /* ── Login / Register tabs ────────────────────────── */
                  <>
                    <Text style={[styles.heading, { color: c.textHeader }]}>Account</Text>

                    {/* Tab toggle */}
                    <View style={[styles.tabRow, { backgroundColor: c.backgroundSecondary, borderColor: c.cardBorder }]}>
                      {(['login', 'register'] as Tab[]).map(t => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.tabBtn, tab === t && { backgroundColor: c.primary }]}
                          onPress={() => { setTab(t); setError(''); }}
                        >
                          <Text style={[styles.tabBtnText, { color: tab === t ? '#121212' : c.textSecondary }]}>
                            {t === 'login' ? 'Log in' : 'Register'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TextInput
                      style={[styles.input, { color: c.textPrimary, borderColor: c.cardBorder }]}
                      placeholder="Username"
                      placeholderTextColor={c.textMuted}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {tab === 'register' && (
                      <TextInput
                        style={[styles.input, { color: c.textPrimary, borderColor: c.cardBorder }]}
                        placeholder="Email (optional)"
                        placeholderTextColor={c.textMuted}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />
                    )}
                    <TextInput
                      style={[styles.input, { color: c.textPrimary, borderColor: c.cardBorder }]}
                      placeholder={tab === 'register' ? 'Password (min 8 chars)' : 'Password'}
                      placeholderTextColor={c.textMuted}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                    />

                    {!!error && (
                      <Text style={[styles.error, { color: '#CC0000' }]}>{error}</Text>
                    )}

                    {loading ? (
                      <ActivityIndicator color={c.primary} style={{ marginTop: 12 }} />
                    ) : (
                      <TouchableOpacity
                        style={[styles.btn, { backgroundColor: c.primary }]}
                        onPress={handleSubmit}
                      >
                        <Text style={styles.btnText}>{tab === 'login' ? 'Log in' : 'Create account'}</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: 320,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 10,
  },
  heading: {
    fontSize: 18,
    fontFamily: 'PoppinsBold',
    marginBottom: 2,
  },
  username: {
    fontSize: 16,
    fontFamily: 'PoppinsBold',
    marginTop: 4,
  },
  meta: {
    fontSize: 12,
    marginTop: -4,
  },
  syncNote: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  tabRow: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    alignItems: 'center',
  },
  tabBtnText: {
    fontFamily: 'PoppinsBold',
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  error: {
    fontSize: 12,
    marginTop: -4,
  },
  btn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: {
    fontFamily: 'PoppinsBold',
    fontSize: 14,
    color: '#121212',
  },
});
