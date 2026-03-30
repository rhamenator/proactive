import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Pill } from '../components/Pill';
import { Screen } from '../components/Screen';
import { useApp } from '../context/AppContext';
import { colors, radius, spacing, typography } from '../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { VisitResult } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AddressDetail'>;

export function AddressDetailScreen({ navigation, route }: Props) {
  const { getAddressById, outcomes, submitVisit, listRecentVisits, correctVisit } = useApp();
  const [selected, setSelected] = useState<VisitResult | null>(null);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentVisitId, setRecentVisitId] = useState<string | null>(null);

  const address = getAddressById(route.params.addressId);
  const activeOutcome = useMemo(
    () => outcomes.find((item) => item.code === selected),
    [outcomes, selected]
  );

  useEffect(() => {
    let mounted = true;

    async function loadRecent() {
      try {
        const recent = await listRecentVisits(route.params.addressId);
        if (!mounted) {
          return;
        }

        const latest = recent[0];
        if (latest) {
          setRecentVisitId(latest.id);
          setSelected(latest.outcomeCode);
          setNotes(latest.notes ?? '');
        } else {
          setRecentVisitId(null);
        }
      } catch {
        if (mounted) {
          setRecentVisitId(null);
        }
      }
    }

    void loadRecent();

    return () => {
      mounted = false;
    };
  }, [listRecentVisits, route.params.addressId]);

  async function handleSubmit() {
    if (!address || !selected) {
      Alert.alert('Choose a result', 'Select a visit result before submitting.');
      return;
    }

    setLoading(true);
    try {
      if (recentVisitId) {
        if (!reason.trim()) {
          Alert.alert('Add a reason', 'Corrections require a short audit reason.');
          return;
        }
        await correctVisit(recentVisitId, selected, notes, reason);
      } else {
        await submitVisit(address.id, selected, notes);
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Unable to submit', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!address) {
    return (
      <Screen>
        <View style={styles.missing}>
          <Text style={styles.title}>Address not found</Text>
          <Text style={styles.copy}>This record is not available in the current turf snapshot.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.summaryCard}>
          <Text style={styles.label}>Visit Detail</Text>
          <Text style={styles.title}>{address.addressLine1}</Text>
          <Text style={styles.copy}>
            {address.city}, {address.state}
            {address.zip ? ` ${address.zip}` : ''}
          </Text>
          {address.vanId ? <Pill label={`VAN ${address.vanId}`} tone="gold" /> : null}
          <Text style={styles.gpsText}>
            GPS will be captured at submission time and compared against the target address.
          </Text>
        </Card>

        <Card style={styles.resultCard}>
          <Text style={styles.section}>Result</Text>
          {recentVisitId ? (
            <Text style={styles.copy}>You are correcting your most recent submission for this address.</Text>
          ) : null}
          <View style={styles.grid}>
            {outcomes.filter((item) => item.isActive).map((item) => {
              const active = selected === item.code;
              return (
                <Button
                  key={item.code}
                  label={item.label}
                  onPress={() => setSelected(item.code)}
                  variant={active ? 'result' : 'secondary'}
                  style={styles.resultButton}
                />
              );
            })}
          </View>
        </Card>

        <Card style={styles.notesCard}>
          <Text style={styles.section}>Notes</Text>
          <TextInput
            multiline
            placeholder={activeOutcome?.requiresNote ? 'Notes required for this outcome' : 'Optional notes for the field report'}
            placeholderTextColor={colors.muted}
            value={notes}
            onChangeText={setNotes}
            style={styles.notesInput}
          />
        </Card>

        {recentVisitId ? (
          <Card style={styles.notesCard}>
            <Text style={styles.section}>Correction Reason</Text>
            <TextInput
              placeholder="Why are you correcting this visit?"
              placeholderTextColor={colors.muted}
              value={reason}
              onChangeText={setReason}
              style={styles.reasonInput}
            />
          </Card>
        ) : null}

        <View style={styles.actions}>
          <Button
            label={recentVisitId ? 'Save Correction' : 'Submit Visit'}
            onPress={() => void handleSubmit()}
            loading={loading}
            disabled={!selected}
          />
          <Button label="Back to List" onPress={() => navigation.goBack()} variant="ghost" />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  summaryCard: {
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
    fontSize: 26,
    fontWeight: '900',
  },
  copy: {
    color: colors.muted,
    lineHeight: 21,
  },
  gpsText: {
    color: colors.text,
    lineHeight: 20,
    paddingTop: spacing.xs,
  },
  resultCard: {
    gap: spacing.sm,
  },
  section: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  grid: {
    gap: spacing.sm,
  },
  resultButton: {
    alignSelf: 'stretch',
  },
  notesCard: {
    gap: spacing.sm,
  },
  notesInput: {
    minHeight: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    backgroundColor: colors.cream,
    textAlignVertical: 'top',
    fontSize: typography.body,
  },
  reasonInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.text,
    backgroundColor: colors.cream,
    fontSize: typography.body,
  },
  actions: {
    gap: spacing.sm,
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
});
