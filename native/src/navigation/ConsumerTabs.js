import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ConsumerDashboard from '../screens/ConsumerDashboard';
import ConsumerMarketplaceScreen from '../screens/consumer/MarketplaceScreen';
import MyOrdersScreen from '../screens/consumer/MyOrdersScreen';
import ConsumerWalletScreen from '../screens/consumer/WalletScreen';
import ConsumerHistoryScreen from '../screens/consumer/HistoryScreen';

const Tab = createBottomTabNavigator();

function Placeholder({ title, desc }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: '#0f172a' }}>{title}</Text>
      {desc ? <Text style={{ marginTop: 8, color: '#475569', textAlign: 'center' }}>{desc}</Text> : null}
    </View>
  );
}

function MarketplaceScreen() {
  return <Placeholder title="Marketplace" desc="Browse and purchase e‑coupons (native coming soon)." />;
}
function OrdersScreen() {
  return <Placeholder title="My Orders" desc="List of your e‑coupon orders (native coming soon)." />;
}
function WalletScreen() {
  return <Placeholder title="Wallet" desc="View balance and coupon codes (native coming soon)." />;
}
function HistoryScreen() {
  return <Placeholder title="History" desc="Redeem / transfer history (native coming soon)." />;
}

function LogoutButton({ navigation }) {
  async function onLogout() {
    try {
      await AsyncStorage.multiRemove(['token', 'refresh', 'user']);
    } catch {}
    navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Auth' }] });
  }
  return (
    <Pressable onPress={onLogout} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
      <Text style={{ color: '#ef4444', fontWeight: '700' }}>Logout</Text>
    </Pressable>
  );
}

export default function ConsumerTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerTitleAlign: 'center',
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: { backgroundColor: '#fff' },
        headerStyle: { backgroundColor: '#fff' },
        headerShadowVisible: false,
        tabBarIcon: ({ color, size }) => {
          let name = 'home';
          switch (route.name) {
            case 'Home':
              name = 'home';
              break;
            case 'Marketplace':
              name = 'pricetags';
              break;
            case 'Orders':
              name = 'receipt';
              break;
            case 'Wallet':
              name = 'wallet';
              break;
            case 'History':
              name = 'time';
              break;
            default:
              name = 'ellipse';
          }
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={ConsumerDashboard}
        options={({ navigation }) => ({
          headerRight: () => <LogoutButton navigation={navigation} />,
          title: 'Consumer',
        })}
      />
      <Tab.Screen
        name="Marketplace"
        component={ConsumerMarketplaceScreen}
        options={({ navigation }) => ({
          headerRight: () => <LogoutButton navigation={navigation} />,
        })}
      />
      <Tab.Screen
        name="Orders"
        component={MyOrdersScreen}
        options={({ navigation }) => ({
          headerRight: () => <LogoutButton navigation={navigation} />,
        })}
      />
      <Tab.Screen
        name="Wallet"
        component={ConsumerWalletScreen}
        options={({ navigation }) => ({
          headerRight: () => <LogoutButton navigation={navigation} />,
        })}
      />
      <Tab.Screen
        name="History"
        component={ConsumerHistoryScreen}
        options={({ navigation }) => ({
          headerRight: () => <LogoutButton navigation={navigation} />,
        })}
      />
    </Tab.Navigator>
  );
}
