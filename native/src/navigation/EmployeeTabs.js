import React from 'react';
import { View, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import EmployeeDashboard from '../screens/EmployeeDashboard';

const Tab = createBottomTabNavigator();

function Placeholder({ title, desc }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: '#0f172a' }}>{title}</Text>
      {desc ? <Text style={{ marginTop: 8, color: '#475569', textAlign: 'center' }}>{desc}</Text> : null}
    </View>
  );
}

function DailyScreen() {
  return <Placeholder title="Daily Report" desc="View or submit daily activity (native coming soon)." />;
}
function TargetsScreen() {
  return <Placeholder title="Targets" desc="Track rewards & targets (native coming soon)." />;
}
function OrdersScreen() {
  return <Placeholder title="Orders" desc="Manage assigned orders (native coming soon)." />;
}
function SupportScreen() {
  return <Placeholder title="Support" desc="Raise or resolve tickets (native coming soon)." />;
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

export default function EmployeeTabs() {
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
            case 'Daily':
              name = 'calendar';
              break;
            case 'Targets':
              name = 'trophy';
              break;
            case 'Orders':
              name = 'receipt';
              break;
            case 'Support':
              name = 'help-buoy';
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
        component={EmployeeDashboard}
        options={({ navigation }) => ({
          headerRight: () => <LogoutButton navigation={navigation} />,
          title: 'Employee',
        })}
      />
      <Tab.Screen
        name="Daily"
        component={DailyScreen}
        options={({ navigation }) => ({
          headerRight: () => <LogoutButton navigation={navigation} />,
        })}
      />
      <Tab.Screen
        name="Targets"
        component={TargetsScreen}
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
        name="Support"
        component={SupportScreen}
        options={({ navigation }) => ({
          headerRight: () => <LogoutButton navigation={navigation} />,
        })}
      />
    </Tab.Navigator>
  );
}
