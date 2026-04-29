/**
 * FranchiseDashboardRN.js
 * React Native (Expo) port of the web FranchiseDashboard.
 * - No @mui/material, no framer-motion, no react-router-dom
 * - Icons via @expo/vector-icons (Ionicons + MaterialCommunityIcons)
 * - Navigation via React Navigation (prop: navigation)
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Constants ───────────────────────────────────────────────────────────────

const COLORS = {
  primary: '#0ea5e9',
  primaryDark: '#0284c7',
  success: '#22c55e',
  secondary: '#a855f7',
  background: '#f1f5f9',
  surface: '#ffffff',
  text: '#0f172a',
  textSecondary: '#64748b',
  border: '#e5e7eb',
};

const CARD_W = 200;
const CARD_H = 180;

// ─── Static Data (mirrors web version exactly) ────────────────────────────────

const achievers = [
  { rank: '#1', name: 'Prakash Kumar', value: '₹2.5L', color: COLORS.success,     photo: 'https://i.pravatar.cc/120?img=12' },
  { rank: '#2', name: 'Priya Sharma',  value: '₹2.2L', color: COLORS.primary,     photo: 'https://i.pravatar.cc/120?img=15' },
  { rank: '#3', name: 'Amit Patel',    value: '₹2.1L', color: COLORS.primaryDark, photo: 'https://i.pravatar.cc/120?img=10' },
  { rank: '#4', name: 'Sneha Reddy',   value: '₹1.9L', color: COLORS.secondary,   photo: 'https://i.pravatar.cc/120?img=18' },
  { rank: '#5', name: 'Vikram Singh',  value: '₹1.8L', color: COLORS.success,     photo: 'https://i.pravatar.cc/120?img=22' },
  { rank: '#6', name: 'Meera Nair',    value: '₹1.7L', color: COLORS.primary,     photo: 'https://i.pravatar.cc/120?img=20' },
];

const pincodeOverviewMetrics = [
  { title: 'Pincode Total Consumers',            value: '1,245', iconLib: 'ionicons',  icon: 'people-outline',         accent: COLORS.primary },
  { title: 'Pincode Captain Office',             value: '12',    iconLib: 'material',  icon: 'briefcase-outline',      accent: COLORS.success },
  { title: 'Pincode Sarathi Count',              value: '45',    iconLib: 'material',  icon: 'headset',                accent: COLORS.secondary },
  { title: 'Pincode All Type of Model Merchant', value: '89',    iconLib: 'ionicons',  icon: 'storefront-outline',     accent: COLORS.primaryDark },
  { title: 'Pincode Total Self Rebirth Count',   value: '567',   iconLib: 'ionicons',  icon: 'document-text-outline',  accent: COLORS.success },
];

const pincodeCoordinatorOverviewMetrics = [
  { title: 'Pincode Total Consumer',             value: '489',  iconLib: 'ionicons', icon: 'people-outline',       accent: COLORS.primary },
  { title: 'Pincode Captain Office',             value: '12',   iconLib: 'material', icon: 'briefcase-outline',    accent: COLORS.success },
  { title: 'Pincode Sarathi',                    value: '8889', iconLib: 'material', icon: 'hubspot',              accent: COLORS.secondary },
  { title: 'Pincode All Type of Model Merchant', value: '8889', iconLib: 'material', icon: 'file-tree-outline',    accent: COLORS.primaryDark },
];

const growthData = {
  Daily: [
    { name: 'Mon', value: 420 }, { name: 'Tue', value: 510 }, { name: 'Wed', value: 470 },
    { name: 'Thu', value: 560 }, { name: 'Fri', value: 620 }, { name: 'Sat', value: 710 },
    { name: 'Sun', value: 760 },
  ],
  Weekly: [
    { name: 'W1', value: 3200 }, { name: 'W2', value: 3600 },
    { name: 'W3', value: 3400 }, { name: 'W4', value: 4100 },
  ],
  Monthly: [
    { name: 'Jan', value: 5.2 }, { name: 'Feb', value: 6.1 }, { name: 'Mar', value: 5.8 },
    { name: 'Apr', value: 6.3 }, { name: 'May', value: 6.8 },
  ],
};

// ─── Small helper: icon renderer ─────────────────────────────────────────────

function MetricIcon({ iconLib, icon, color }) {
  if (iconLib === 'material') {
    return <MaterialCommunityIcons name={icon} size={22} color={color} />;
  }
  return <Ionicons name={icon} size={22} color={color} />;
}

// ─── AchieverCard ─────────────────────────────────────────────────────────────

function AchieverCard({ rank, name, value, color, photo }) {
  return (
    <View style={styles.achieverCard}>
      <Image source={{ uri: photo }} style={styles.achieverAvatar} />
      <View style={[styles.achieverBadge, { backgroundColor: color }]}>
        <Text style={styles.achieverBadgeText}>{rank}</Text>
      </View>
      <Text style={styles.achieverName} numberOfLines={1}>{name}</Text>
      <Text style={[styles.achieverValue, { color }]}>{value}</Text>
    </View>
  );
}

// ─── OverviewMetricCard ───────────────────────────────────────────────────────

function OverviewMetricCard({ title, value, iconLib, icon, accent }) {
  return (
    <View style={[styles.metricCard, { borderLeftColor: accent, borderLeftWidth: 3 }]}>
      {/* Icon */}
      <View style={[styles.metricIconBox, { backgroundColor: accent + '18' }]}>
        <MetricIcon iconLib={iconLib} icon={icon} color={accent} />
      </View>

      {/* Title — max 2 lines */}
      <Text style={styles.metricTitle} numberOfLines={2}>{title}</Text>

      {/* Value — never wraps */}
      <Text style={[styles.metricValue, { color: accent }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ─── OverviewSection ─────────────────────────────────────────────────────────

function OverviewSection({ title, metrics }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.divider} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.metricsRow}
      >
        {metrics.map((m) => (
          <OverviewMetricCard key={m.title} {...m} />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── GrowthBar ────────────────────────────────────────────────────────────────

function GrowthBar({ data, maxValue }) {
  const BAR_MAX_H = 120;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.growthBarRow}>
        {data.map((item) => {
          const barH = Math.max(16, (item.value / maxValue) * BAR_MAX_H);
          return (
            <View key={item.name} style={styles.growthBarItem}>
              <View style={[styles.growthBar, { height: barH }]} />
              <Text style={styles.growthBarLabel}>{item.name}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ─── UserProfile card ─────────────────────────────────────────────────────────

function FranchiseUserProfile({ name, role, type, userId, location, performance }) {
  return (
    <View style={styles.heroCard}>
      {/* Name + role */}
      <Text style={styles.profileName}>{name}</Text>
      <Text style={styles.profileRole}>{role}</Text>

      {/* Franchise type row */}
      <View style={styles.profileRow}>
        <MaterialCommunityIcons name="office-building-outline" size={16} color="rgba(255,255,255,0.9)" />
        <Text style={styles.profileType}> Franchise Type: {type}</Text>
      </View>

      {/* Stats glass card */}
      <View style={styles.profileStatsBox}>
        <View style={styles.profileStat}>
          <Ionicons name="id-card-outline" size={18} color="rgba(255,255,255,0.85)" />
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.profileStatLabel}>User ID</Text>
            <Text style={styles.profileStatValue}>{userId}</Text>
          </View>
        </View>
        <View style={styles.profileStat}>
          <Ionicons name="location-outline" size={18} color="rgba(255,255,255,0.85)" />
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.profileStatLabel}>Location</Text>
            <Text style={styles.profileStatValue}>{location}</Text>
          </View>
        </View>
        <View style={styles.profileStat}>
          <Ionicons name="trending-up-outline" size={18} color="rgba(255,255,255,0.85)" />
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.profileStatLabel}>Performance</Text>
            <Text style={styles.profileStatValue}>{performance}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FranchiseDashboardRN({ navigation }) {
  const insets = useSafeAreaInsets();
  const [selectedTab, setSelectedTab] = useState('Daily');

  const selectedData = growthData[selectedTab];
  const maxDataValue = useMemo(
    () => Math.max(...selectedData.map((d) => d.value), 1),
    [selectedData],
  );

  const openDrawer = () => {
    // If using Drawer Navigator:
    if (navigation?.openDrawer) navigation.openDrawer();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.success} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Card (gradient simulation via background color) ── */}
        <View style={styles.heroGradient}>
          {/* Top row: Hamburger + Title + Action Icons */}
          <View style={styles.heroTopRow}>
            {/* LEFT: hamburger + title */}
            <View style={styles.heroLeft}>
              <TouchableOpacity
                onPress={openDrawer}
                style={styles.heroIconBtn}
                accessibilityLabel="Open menu"
              >
                <Feather name="menu" size={20} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.heroTitle} numberOfLines={1}>Tri Growth</Text>
            </View>

            {/* RIGHT: action icons */}
            <View style={styles.heroRight}>
              <TouchableOpacity style={styles.heroIconBtn}>
                <Ionicons name="notifications-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.heroIconBtn}
                onPress={() => navigation?.navigate && navigation.navigate('FranchiseWallet')}
              >
                <MaterialCommunityIcons name="wallet-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.heroIconBtn}>
                <Ionicons name="location-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* User Profile section */}
          <FranchiseUserProfile
            name="Prakash J"
            role="Franchise Partner"
            type="Master Franchise"
            userId="TRFN 56157223"
            location="Bangalore"
            performance="94%"
          />
        </View>

        {/* ── Spacing between full-bleed and cards below ── */}
        <View style={styles.belowHero}>

          {/* ── Top Achievers ── */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>🏆 Top Achievers</Text>
            <View style={styles.divider} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricsRow}>
              {achievers.map((a) => (
                <AchieverCard key={a.rank} {...a} />
              ))}
            </ScrollView>
          </View>

          {/* ── Pincode Overview ── */}
          <OverviewSection
            title="Pincode Overview Count"
            metrics={pincodeOverviewMetrics}
          />

          {/* ── Pincode Co-ordinator Overview ── */}
          <OverviewSection
            title="Pincode - Co-ordinator Overview Count"
            metrics={pincodeCoordinatorOverviewMetrics}
          />

          {/* ── Growth Analytics ── */}
          <View style={styles.sectionCard}>
            <View style={styles.growthHeader}>
              <Text style={styles.sectionTitle}>📈 Growth Analytics</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.tabRow}>
                  {Object.keys(growthData).map((tab) => (
                    <TouchableOpacity
                      key={tab}
                      onPress={() => setSelectedTab(tab)}
                      style={[
                        styles.tab,
                        selectedTab === tab && styles.tabActive,
                      ]}
                    >
                      <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>
                        {tab}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View style={styles.divider} />
            <GrowthBar data={selectedData} maxValue={maxDataValue} />
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const { width: SW } = Dimensions.get('window');

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  // ── Hero gradient card ──
  heroGradient: {
    backgroundColor: COLORS.success,            // solid fallback; use LinearGradient for real gradient
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    overflow: 'hidden',
  },
  heroRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    flexShrink: 1,
  },

  // ── Profile ──
  heroCard: {
    // sits inside heroGradient — no extra background needed
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 2,
  },
  profileRole: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 6,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileType: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  profileStatsBox: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    padding: 14,
    gap: 12,
  },
  profileStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileStatLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
  },
  profileStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },

  // ── Below-hero padding wrapper ──
  belowHero: {
    paddingHorizontal: 12,
    paddingTop: 16,
    gap: 16,
    flexDirection: 'column',
  },

  // ── Generic section card ──
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  metricsRow: {
    gap: 12,
    paddingVertical: 4,
    paddingRight: 4,
  },

  // ── OverviewMetricCard ──
  metricCard: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    justifyContent: 'space-between',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  metricIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    lineHeight: 16,
    flexShrink: 1,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    numberOfLines: 1,
  },

  // ── AchieverCard ──
  achieverCard: {
    width: 140,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 6,
  },
  achieverAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.border,
  },
  achieverBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achieverBadgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  achieverName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  achieverValue: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },

  // ── GrowthBar ──
  growthHeader: { gap: 8 },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.background,
  },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  tabTextActive: { color: '#fff' },
  growthBarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingVertical: 8,
    minHeight: 140,
  },
  growthBarItem: {
    alignItems: 'center',
    width: 36,
  },
  growthBar: {
    width: 28,
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    marginBottom: 4,
  },
  growthBarLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
});
