import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import FranchiseDashboardRN from './src/screens/FranchiseDashboardRN';

export default function App() {
  return (
    <SafeAreaProvider>
      <FranchiseDashboardRN navigation={{}} />
    </SafeAreaProvider>
  );
}
