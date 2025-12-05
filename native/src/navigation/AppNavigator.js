import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

// Role dashboards (simple placeholders for now)
import ConsumerDashboard from '../screens/ConsumerDashboard';
import AgencyDashboard from '../screens/AgencyDashboard';
import EmployeeDashboard from '../screens/EmployeeDashboard';
import ConsumerTabs from '../navigation/ConsumerTabs';
import AgencyTabs from '../navigation/AgencyTabs';
import EmployeeTabs from '../navigation/EmployeeTabs';
import KYCScreen from '../screens/consumer/KYCScreen';
import ProfileScreen from '../screens/consumer/ProfileScreen';
import ECouponScreen from '../screens/consumer/ECouponScreen';
import MyTeamScreen from '../screens/consumer/MyTeamScreen';
import ReferEarnScreen from '../screens/consumer/ReferEarnScreen';

const RootStack = createNativeStackNavigator();
const Stack = createNativeStackNavigator();

function LogoutButton({ navigation }) {
  async function onLogout() {
    try {
      await AsyncStorage.multiRemove(['token', 'refresh', 'user']);
    } catch {}
    navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
  }
  return (
    <Pressable onPress={onLogout} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
      <Text style={{ color: '#ef4444', fontWeight: '700' }}>Logout</Text>
    </Pressable>
  );
}

function ConsumerStackScreen() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={ConsumerTabs} />
      <Stack.Screen name="KYC" component={KYCScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="ECoupon" component={ECouponScreen} />
      <Stack.Screen name="MyTeam" component={MyTeamScreen} />
      <Stack.Screen name="ReferEarn" component={ReferEarnScreen} />
    </Stack.Navigator>
  );
}

function AgencyStackScreen() {
  return <AgencyTabs />;
}

function EmployeeStackScreen() {
  return <EmployeeTabs />;
}

function useBootstrap() {
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState('Auth');

  useEffect(() => {
    (async () => {
      try {
        const [token, userStr] = await Promise.all([
          AsyncStorage.getItem('token'),
          AsyncStorage.getItem('user'),
        ]);
        if (token && userStr) {
          let role = '';
          try {
            const u = JSON.parse(userStr);
            role = String(u?.role || u?.category || '').toLowerCase();
          } catch {}
          if (role.startsWith('agency')) setInitial('Agency');
          else if (role.startsWith('employee')) setInitial('Employee');
          else setInitial('Consumer');
        } else {
          setInitial('Auth');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { loading, initial };
}

export default function AppNavigator() {
  const { loading, initial } = useBootstrap();

  const theme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#f1f5f9',
    },
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 8, color: '#334155', fontWeight: '600' }}>Loading…</Text>
      </View>
    );
  }

  return (
    <NavigationContainer theme={theme}>
      <RootStack.Navigator initialRouteName={initial} screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Auth" component={LoginScreen} />
        <RootStack.Screen name="Register" component={RegisterScreen} />
        <RootStack.Screen name="Consumer" component={ConsumerStackScreen} />
        <RootStack.Screen name="Agency" component={AgencyStackScreen} />
        <RootStack.Screen name="Employee" component={EmployeeStackScreen} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
