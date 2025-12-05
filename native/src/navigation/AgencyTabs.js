import React from 'react';
import { View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AgencyDashboard from '../screens/AgencyDashboard';
import AgencyProductsScreen from '../screens/agency/ProductsScreen';

const Tab = createBottomTabNavigator();

function Placeholder({ title, desc }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: '#0f172a' }}>{title}</Text>
      {desc ? <Text style={{ marginTop: 8, color: '#475569', textAlign: 'center' }}>{desc}</Text> : null}
    </View>
  );
}

function ProductsScreen() {
  return <Placeholder title="Products" desc="Manage catalog (native coming soon)." />;
}
function BannersScreen() {
  return <Placeholder title="Banners" desc="Manage promotional banners (native coming soon)." />;
}
function OrdersScreen() {
  return <Placeholder title="Orders" desc="View and fulfill orders (native coming soon)." />;
}
function PurchasesScreen() {
  return <Placeholder title="Purchase Requests" desc="Handle incoming requests (native coming soon)." />;
}
function ReportsScreen() {
  return <Placeholder title="Reports" desc="Daily / summary reports (native coming soon)." />;
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

export default function AgencyTabs() {
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
            case 'Products':
              name = 'cube';
              break;
            case 'Banners':
              name = 'images';
              break;
            case 'Orders':
              name = 'receipt';
              break;
            case 'Purchases':
              name = 'cart';
              break;
            case 'Reports':
              name = 'stats-chart';
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
        component={AgencyDashboard}
        options={({ navigation }) => ({
          headerRight: () => <LogoutButton navigation={navigation} />,
          title: 'Agency',
        })}
      />
      <Tab.Screen
        name="Products"
        component={AgencyProductsScreen}
        options={({ navigation }) => ({
          headerRight: () => <LogoutButton navigation={navigation} />,
        })}
      />
      <Tab.Screen
        name="Banners"
        component={BannersScreen}
        options={({ navigation }) => ({
          headerRight: () => <LogoutButton navigation={navigation} />,
        })}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={({ navigation }) => ({
          headerRight: () => <LogoutButton navigation={navigation} />,
        })}
      />
      <Tab.Screen
        name="Purchases"
        component={PurchasesScreen}
        options={({ navigation }) => ({
          headerRight: () => <LogoutButton navigation={navigation} />,
        })}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={({ navigation }) => ({
          headerRight: () => <LogoutButton navigation={navigation} />,
        })}
      />
    </Tab.Navigator>
  );
}
