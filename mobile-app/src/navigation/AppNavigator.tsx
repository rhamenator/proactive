import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import { useApp } from '../context/AppContext';
import { AddressDetailScreen } from '../screens/AddressDetailScreen';
import { AddressListScreen } from '../screens/AddressListScreen';
import { AddressRequestScreen } from '../screens/AddressRequestScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { PerformanceScreen } from '../screens/PerformanceScreen';
import { QueueScreen } from '../screens/QueueScreen';
import { SessionNotesScreen } from '../screens/SessionNotesScreen';

export type RootStackParamList = {
  Dashboard: undefined;
  AddressList: undefined;
  AddressDetail: { addressId: string };
  AddressRequest: undefined;
  Queue: undefined;
  SessionNotes: undefined;
  Performance: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.cream,
    card: colors.paper,
    text: colors.text,
    border: colors.border,
    primary: colors.blue,
  },
};

function BootScreen() {
  return (
    <View style={styles.boot}>
      <ActivityIndicator size="large" color={colors.gold} />
      <Text style={styles.bootTitle}>Loading field session</Text>
      <Text style={styles.bootText}>Restoring token, turf data, and queue state.</Text>
    </View>
  );
}

export function AppNavigator() {
  const { isBootstrapping, user, logout } = useApp();

  if (isBootstrapping) {
    return <BootScreen />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.navy,
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: '800',
          },
          contentStyle: {
            backgroundColor: colors.cream,
          },
        }}
      >
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            title: 'PROACTIVE FCS',
            headerRight: () => (
              <Pressable onPress={() => void logout()} style={styles.logout}>
                <Text style={styles.logoutText}>Logout</Text>
              </Pressable>
            ),
          }}
        />
        <Stack.Screen name="AddressList" component={AddressListScreen} options={{ title: 'House List' }} />
        <Stack.Screen
          name="AddressDetail"
          component={AddressDetailScreen}
          options={{ title: 'Visit Detail' }}
        />
        <Stack.Screen name="AddressRequest" component={AddressRequestScreen} options={{ title: 'Request Address' }} />
        <Stack.Screen name="Queue" component={QueueScreen} options={{ title: 'Sync Queue' }} />
        <Stack.Screen name="SessionNotes" component={SessionNotesScreen} options={{ title: 'Session Notes' }} />
        <Stack.Screen name="Performance" component={PerformanceScreen} options={{ title: 'My Performance' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.cream,
  },
  bootTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  bootText: {
    fontSize: 14,
    color: colors.muted,
  },
  logout: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  logoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
