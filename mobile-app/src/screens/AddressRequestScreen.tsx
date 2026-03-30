import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { useApp } from '../context/AppContext';
import { colors, radius, spacing, typography } from '../theme';

export function AddressRequestScreen() {
  const { turf, addressRequests, submitAddressRequest } = useApp();
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('MI');
  const [zip, setZip] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!addressLine1.trim() || !city.trim() || !state.trim()) {
      Alert.alert('Missing fields', 'Address line, city, and state are required.');
      return;
    }

    setLoading(true);
    try {
      await submitAddressRequest({ addressLine1, city, state, zip, notes });
      setAddressLine1('');
      setCity('');
      setState('MI');
      setZip('');
      setNotes('');
      Alert.alert('Submitted', 'The missing address request was sent for review.');
    } catch (error) {
      Alert.alert('Unable to submit', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.label}>Request Missing Address</Text>
          <Text style={styles.title}>{turf?.name ?? 'No assigned turf'}</Text>
          <Text style={styles.copy}>
            Submit a missing household for review. It will not become a live walk-list address until it is approved.
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.section}>Address details</Text>
          <TextInput value={addressLine1} onChangeText={setAddressLine1} placeholder="123 Main St" placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={colors.muted} style={styles.input} />
          <View style={styles.row}>
            <TextInput value={state} onChangeText={setState} placeholder="State" placeholderTextColor={colors.muted} style={[styles.input, styles.rowInput]} autoCapitalize="characters" maxLength={2} />
            <TextInput value={zip} onChangeText={setZip} placeholder="ZIP" placeholderTextColor={colors.muted} style={[styles.input, styles.rowInput]} keyboardType="number-pad" />
          </View>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes for the reviewer"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.notes]}
            multiline
          />
          <Button label="Submit Request" onPress={() => void handleSubmit()} loading={loading} disabled={!turf} />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.section}>My recent requests</Text>
          <View style={styles.stack}>
            {addressRequests.map((request) => (
              <Card key={request.id} style={styles.subtleCard}>
                <Text style={styles.requestAddress}>{request.requestedAddress.addressLine1}</Text>
                <Text style={styles.copy}>
                  {request.requestedAddress.city}, {request.requestedAddress.state}
                  {request.requestedAddress.zip ? ` ${request.requestedAddress.zip}` : ''}
                </Text>
                <Text style={styles.copy}>
                  Status: {request.status}
                  {request.reviewReason ? ` • ${request.reviewReason}` : ''}
                </Text>
              </Card>
            ))}
            {!addressRequests.length ? <Text style={styles.copy}>No address requests submitted yet.</Text> : null}
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    gap: spacing.sm,
  },
  subtleCard: {
    gap: spacing.xs,
    backgroundColor: colors.cream,
  },
  stack: {
    gap: spacing.sm,
  },
  label: {
    color: colors.blue,
    fontSize: typography.small,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  section: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  copy: {
    color: colors.muted,
    lineHeight: 21,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowInput: {
    flex: 1,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    backgroundColor: colors.cream,
  },
  notes: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  requestAddress: {
    color: colors.text,
    fontWeight: '900',
  },
});
