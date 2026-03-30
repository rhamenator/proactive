import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { useApp } from '../context/AppContext';
import { deleteSessionNote, loadSessionNotes, saveSessionNote } from '../storage';
import { colors, radius, spacing, typography } from '../theme';
import type { SessionNote } from '../types';
import { formatLocalDateTime } from '../utils/datetime';

function createNoteId() {
  return globalThis.crypto?.randomUUID?.() ?? `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function SessionNotesScreen() {
  const { turf, session } = useApp();
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [addressText, setAddressText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!turf) {
      setNotes([]);
      return;
    }

    setNotes(await loadSessionNotes(turf.id, session?.id ?? null));
  }, [session?.id, turf]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (!turf) {
      Alert.alert('No active turf', 'Start or resume a turf before saving field notes.');
      return;
    }

    const trimmedNote = noteText.trim();
    const trimmedAddress = addressText.trim();
    if (!trimmedNote) {
      Alert.alert('Note required', 'Add a note before saving.');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      await saveSessionNote({
        id: createNoteId(),
        turfId: turf.id,
        sessionId: session?.id ?? null,
        createdAt: now,
        updatedAt: now,
        addressText: trimmedAddress || null,
        noteText: trimmedNote
      });
      setAddressText('');
      setNoteText('');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(noteId: string) {
    await deleteSessionNote(noteId);
    await load();
  }

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.content}
        data={notes}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <Card style={styles.header}>
            <Text style={styles.title}>Session Notes</Text>
            <Text style={styles.copy}>
              Capture extra addresses, house-tracking notes, or field reminders while the session is active. Notes are
              saved locally-first on this device.
            </Text>
            <TextInput
              value={addressText}
              onChangeText={setAddressText}
              placeholder="Address or landmark (optional)"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="What needs to be remembered?"
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.input, styles.noteInput]}
            />
            <Button label="Save Note" onPress={() => void handleSave()} loading={saving} />
          </Card>
        }
        renderItem={({ item }) => (
          <Card style={styles.noteCard}>
            <Text style={styles.noteAddress}>{item.addressText || 'General session note'}</Text>
            <Text style={styles.noteText}>{item.noteText}</Text>
            <Text style={styles.meta}>Saved {formatLocalDateTime(item.updatedAt)}</Text>
            <Button label="Delete Note" onPress={() => void handleDelete(item.id)} variant="ghost" />
          </Card>
        )}
        ListEmptyComponent={
          <Card style={styles.noteCard}>
            <Text style={styles.copy}>No in-session notes saved yet.</Text>
          </Card>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900'
  },
  copy: {
    color: colors.muted,
    lineHeight: 21
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.paper,
    color: colors.text
  },
  noteInput: {
    minHeight: 108,
    textAlignVertical: 'top'
  },
  noteCard: {
    gap: spacing.sm
  },
  noteAddress: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800'
  },
  noteText: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 21
  },
  meta: {
    color: colors.muted,
    fontSize: typography.small
  }
});
