// components/AuthCard.tsx
// Small modal card for login / register / logout.
// Opened by the account button in Header.tsx.

import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Alert,
} from 'react-native';
import axios from 'axios';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { syncOnLogin } from '../../services/scoreboardSyncService';
import { getAuthHeader, changePassword } from '../../services/authService';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://snookerapp.up.railway.app/oneFourSeven/';

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

  const [showChangePw, setShowChangePw] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  function resetForm() {
    setUsername('');
    setPassword('');
    setEmail('');
    setError('');
    setShowChangePw(false);
    setOldPw('');
    setNewPw('');
    setConfirmPw('');
    setPwError('');
    setPwSuccess('');
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
    if (tab === 'register' && /[^a-zA-Z0-9@.+\-_]/.test(username.trim())) {
      setError('Username may only contain letters, numbers, and @/./+/-/_ — no spaces.');
      return;
    }
    if (tab === 'register' && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (tab === 'register' && /^\d+$/.test(password)) {
      setError('Password cannot be entirely numbers.');
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

  function handleDeleteAccount() {
    Alert.alert(
      'Delete account?',
      'This will permanently delete your account and all match history saved to the cloud. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const header = await getAuthHeader();
              await axios.delete(`${API_BASE}auth/delete-account/`, { headers: { Authorization: header! } });
              await doLogout();
              close();
            } catch {
              Alert.alert('Error', 'Could not delete account. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  }

  async function handleChangePassword() {
    setPwError('');
    setPwSuccess('');
    if (!oldPw || !newPw || !confirmPw) {
      setPwError('All fields are required.');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('New passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await changePassword(oldPw, newPw);
      setPwSuccess('Password changed successfully.');
      setOldPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'Could not change password.';
      setPwError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.kavWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={close}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.card, { backgroundColor: c.cardBackground, borderColor: c.cardBorder }]}>

                {/* Close button — always visible */}
                <TouchableOpacity style={styles.closeBtn} onPress={close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[styles.closeBtnText, { color: c.textMuted }]}>✕</Text>
                </TouchableOpacity>

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

                    {/* Change password section */}
                    <TouchableOpacity
                      onPress={() => { setShowChangePw(v => !v); setPwError(''); setPwSuccess(''); }}
                      style={styles.deleteBtn}
                    >
                      <Text style={[styles.deleteBtnText, { color: c.textSecondary }]}>
                        {showChangePw ? 'Cancel' : 'Change password'}
                      </Text>
                    </TouchableOpacity>

                    {showChangePw && (
                      <>
                        <TextInput
                          style={[styles.input, { color: c.textPrimary, borderColor: c.cardBorder }]}
                          placeholder="Current password"
                          placeholderTextColor={c.textMuted}
                          value={oldPw}
                          onChangeText={setOldPw}
                          secureTextEntry
                        />
                        <TextInput
                          style={[styles.input, { color: c.textPrimary, borderColor: c.cardBorder }]}
                          placeholder="New password"
                          placeholderTextColor={c.textMuted}
                          value={newPw}
                          onChangeText={setNewPw}
                          secureTextEntry
                        />
                        <TextInput
                          style={[styles.input, { color: c.textPrimary, borderColor: c.cardBorder }]}
                          placeholder="Confirm new password"
                          placeholderTextColor={c.textMuted}
                          value={confirmPw}
                          onChangeText={setConfirmPw}
                          secureTextEntry
                        />
                        {!!pwError && (
                          <Text style={[styles.error, { color: '#CC0000' }]}>{pwError}</Text>
                        )}
                        {!!pwSuccess && (
                          <Text style={[styles.error, { color: '#4CAF50' }]}>{pwSuccess}</Text>
                        )}
                        {loading ? (
                          <ActivityIndicator color={c.primary} style={{ marginTop: 4 }} />
                        ) : (
                          <TouchableOpacity
                            style={[styles.btn, { backgroundColor: c.primary }]}
                            onPress={handleChangePassword}
                          >
                            <Text style={styles.btnText}>Update password</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}

                    {!showChangePw && (
                      loading ? (
                        <ActivityIndicator color={c.primary} style={{ marginTop: 8 }} />
                      ) : (
                        <>
                          <TouchableOpacity
                            style={[styles.btn, { backgroundColor: '#CC0000' }]}
                            onPress={handleLogout}
                          >
                            <Text style={styles.btnText}>Log out</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteBtn}
                            onPress={handleDeleteAccount}
                          >
                            <Text style={[styles.deleteBtnText, { color: c.textMuted }]}>Delete account</Text>
                          </TouchableOpacity>
                        </>
                      )
                    )}
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
                      <Text style={[styles.pwHint, { color: c.textMuted }]}>
                        No spaces — letters, numbers, and @/./+/-/_ only
                      </Text>
                    )}
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
                    {tab === 'register' && (
                      <Text style={[styles.pwHint, { color: c.textMuted }]}>
                        8+ chars · not all numbers · avoid common passwords (e.g. "password1", "12345678")
                      </Text>
                    )}

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
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kavWrapper: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 40,
    padding: 24,
  },
  card: {
    width: 320,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    paddingTop: 14,
    gap: 10,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    marginBottom: -4,
  },
  closeBtnText: {
    fontSize: 18,
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
  pwHint: {
    fontSize: 11,
    marginTop: -6,
    lineHeight: 16,
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
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 2,
  },
  deleteBtnText: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});
