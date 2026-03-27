import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { Pill } from '../components/Pill';
import { Screen } from '../components/Screen';
import { useApp } from '../context/AppContext';
import { colors, radius, spacing, typography } from '../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'AddressList'>;

export function AddressListScreen({ navigation }: Props) {
  const { addresses, progress } = useApp();

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.content}
        data={addresses}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <Card style={styles.header}>
            <Text style={styles.headerLabel}>House List</Text>
            <Text style={styles.headerTitle}>
              {progress.completed}/{progress.total || addresses.length || 0} completed
            </Text>
            <Text style={styles.headerCopy}>
              Tap an address to log a result. The app keeps the touch targets big for outdoor use.
            </Text>
          </Card>
        }
        renderItem={({ item }) => {
          const label = item.pendingSync ? 'Pending sync' : item.lastResult ? 'Completed' : 'Pending';
          const tone = item.pendingSync ? 'gold' : item.lastResult ? 'success' : 'default';

          return (
            <Pressable onPress={() => navigation.navigate('AddressDetail', { addressId: item.id })}>
              <Card style={styles.rowCard}>
                <View style={styles.rowTop}>
                  <View style={styles.textBlock}>
                    <Text style={styles.address}>{item.addressLine1}</Text>
                    <Text style={styles.subline}>
                      {item.city}, {item.state}
                      {item.zip ? ` ${item.zip}` : ''}
                    </Text>
                    {item.vanId ? <Text style={styles.vanId}>VAN {item.vanId}</Text> : null}
                  </View>
                  <Pill label={label} tone={tone} />
                </View>
                {item.lastResult ? (
                  <Text style={styles.resultCopy}>Last result: {formatResult(item.lastResult)}</Text>
                ) : null}
              </Card>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Card style={styles.emptyCard}>
            <Text style={styles.headerTitle}>No addresses loaded</Text>
            <Text style={styles.headerCopy}>Your backend needs to return a turf snapshot with addresses.</Text>
          </Card>
        }
      />
    </Screen>
  );
}

function formatResult(value: string) {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerLabel: {
    color: colors.blue,
    fontSize: typography.small,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  headerCopy: {
    color: colors.muted,
    lineHeight: 21,
  },
  rowCard: {
    gap: spacing.sm,
  },
  rowTop: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  address: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  subline: {
    color: colors.muted,
    fontSize: typography.body,
  },
  vanId: {
    color: colors.blue,
    fontSize: typography.small,
    fontWeight: '700',
  },
  resultCopy: {
    color: colors.text,
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
  },
});
