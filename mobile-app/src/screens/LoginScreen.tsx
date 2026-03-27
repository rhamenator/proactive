import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Field } from '../components/Field';
import { Screen } from '../components/Screen';
import { useApp } from '../context/AppContext';
import { colors, spacing, typography } from '../theme';

export function LoginScreen() {
  const { login, errorMessage, statusMessage } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (error) {
      Alert.alert('Login failed', error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brandBlock}>
            <Text style={styles.kicker}>PROACTIVE</Text>
            <Text style={styles.title}>Field canvassing built for long days and weak signal.</Text>
            <Text style={styles.subtitle}>
              Sign in to load your turf, capture visits, and sync results back to the dashboard.
            </Text>
          </View>

          <Card style={styles.loginCard}>
            <Field label="Email" placeholder="name@example.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <Field label="Password" placeholder="Your password" secureTextEntry value={password} onChangeText={setPassword} />
            <Button label="Continue" onPress={handleLogin} loading={loading} />
            <Text style={styles.hint}>
              API: {process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}
            </Text>
          </Card>

          {(statusMessage || errorMessage) && (
            <Card style={styles.noticeCard}>
              <Text style={styles.noticeLabel}>Session note</Text>
              <Text style={styles.noticeText}>{statusMessage || errorMessage}</Text>
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  brandBlock: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  kicker: {
    color: colors.blue,
    fontSize: typography.small,
    fontWeight: '900',
    letterSpacing: 2,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  loginCard: {
    gap: spacing.md,
  },
  hint: {
    color: colors.muted,
    fontSize: typography.small,
  },
  noticeCard: {
    gap: spacing.xs,
  },
  noticeLabel: {
    color: colors.blue,
    fontWeight: '800',
  },
  noticeText: {
    color: colors.text,
    lineHeight: 20,
  },
});
