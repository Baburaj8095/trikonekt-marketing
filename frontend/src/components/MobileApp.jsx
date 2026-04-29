import React, { useState, useRef, useEffect, Suspense, lazy, useCallback } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Typography,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Container,
  Fade,
  CircularProgress,
} from '@mui/material';
import {
  Home as HomeIcon,
  AccountBalanceWallet as WalletIcon,
  Book as ManualIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';

// Lazy load screen components for better performance with webpack chunk naming
const HomeScreen = lazy(() => import(/* webpackChunkName: "home-screen" */ '../screens/HomeScreen'));
const WalletScreen = lazy(() => import(/* webpackChunkName: "wallet-screen" */ '../screens/WalletScreen'));
const FranchiseScreen = lazy(() => import(/* webpackChunkName: "franchise-screen" */ '../screens/FranchiseScreen'));

// Preload functions for better UX with webpack preloading
const preloadWallet = () => import(/* webpackChunkName: "wallet-screen" */ '../screens/WalletScreen');
const preloadFranchise = () => import(/* webpackChunkName: "franchise-screen" */ '../screens/FranchiseScreen');

// Theme colors
const COLORS = {
  primary: "#0ea5e9",
  primaryDark: "#0284c7",
  success: "#22c55e",
  secondary: "#a855f7",
  background: "#f1f5f9",
  surface: "#ffffff",
  text: "#0f172a",
  border: "#e5e7eb",
};

// Loading component for lazy loaded screens
const ScreenLoader = () => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '60vh',
      flexDirection: 'column',
      gap: 2,
    }}
  >
    <CircularProgress size={40} sx={{ color: COLORS.primary }} />
    <Typography variant="body2" sx={{ color: COLORS.text, opacity: 0.7 }}>
      Loading...
    </Typography>
  </Box>
);

// Performance optimized component
const MobileApp = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState(null);
  const profileButtonRef = useRef(null);

  const handleProfileMenuToggle = useCallback((event) => {
    setProfileMenuAnchor(profileMenuAnchor ? null : event.currentTarget);
  }, [profileMenuAnchor]);

  const handleProfileMenuClose = useCallback(() => {
    setProfileMenuAnchor(null);
  }, []);

  const handleTabChange = useCallback((event, newValue) => {
    setActiveTab(newValue);
    // Close menu when switching tabs
    setProfileMenuAnchor(null);
    
    // Preload adjacent screens for better performance
    if (newValue === 0) {
      // On Home, preload Wallet and Franchise
      preloadWallet();
      preloadFranchise();
    } else if (newValue === 1) {
      // On Wallet, preload Franchise
      preloadFranchise();
    }
  }, []);

  const renderScreen = useCallback(() => {
    switch (activeTab) {
      case 0:
        return <HomeScreen />;
      case 1:
        return <WalletScreen />;
      case 2:
        return <FranchiseScreen />;
      default:
        return <HomeScreen />;
    }
  }, [activeTab]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: COLORS.background }}>
      {/* Sticky Header */}
      <AppBar
        position="sticky"
        sx={{
          bgcolor: COLORS.surface,
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: 2 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              color: COLORS.text,
              fontSize: '1.1rem',
            }}
          >
            TriKonekt
          </Typography>

          {/* Profile Icon */}
          <IconButton
            ref={profileButtonRef}
            onClick={handleProfileMenuToggle}
            sx={{
              p: 0.5,
              borderRadius: 2,
              '&:hover': {
                bgcolor: `${COLORS.primary}10`,
              },
            }}
            aria-label="Profile menu"
            aria-haspopup="true"
            aria-expanded={Boolean(profileMenuAnchor)}
          >
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.success})`,
              }}
            >
              <PersonIcon sx={{ fontSize: 20, color: 'white' }} />
            </Avatar>
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Profile Dropdown Menu */}
      <Menu
        anchorEl={profileMenuAnchor}
        open={Boolean(profileMenuAnchor)}
        onClose={handleProfileMenuClose}
        TransitionComponent={Fade}
        transitionDuration={200}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            mt: 1,
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            border: `1px solid ${COLORS.border}`,
            minWidth: 180,
          },
        }}
      >
        <MenuItem
          onClick={handleProfileMenuClose}
          sx={{
            py: 1.5,
            px: 2,
            '&:hover': { bgcolor: `${COLORS.primary}10` },
          }}
        >
          <PersonIcon sx={{ mr: 2, fontSize: 20, color: COLORS.primary }} />
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Profile
          </Typography>
        </MenuItem>
        <MenuItem
          onClick={handleProfileMenuClose}
          sx={{
            py: 1.5,
            px: 2,
            '&:hover': { bgcolor: `${COLORS.primary}10` },
          }}
        >
          <SettingsIcon sx={{ mr: 2, fontSize: 20, color: COLORS.primary }} />
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Settings
          </Typography>
        </MenuItem>
        <MenuItem
          onClick={handleProfileMenuClose}
          sx={{
            py: 1.5,
            px: 2,
            '&:hover': { bgcolor: `${COLORS.primary}10` },
          }}
        >
          <LogoutIcon sx={{ mr: 2, fontSize: 20, color: COLORS.primary }} />
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Logout
          </Typography>
        </MenuItem>
      </Menu>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flex: 1,
          py: 2,
          px: 2,
          overflowY: 'auto',
          pb: 10, // Space for bottom nav
        }}
      >
        <Container maxWidth="sm" sx={{ px: 0 }}>
          <Suspense fallback={<ScreenLoader />}>
            {renderScreen()}
          </Suspense>
        </Container>
      </Box>

      {/* Bottom Navigation */}
      <Paper
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          borderTop: `1px solid ${COLORS.border}`,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
        }}
        elevation={3}
      >
        <BottomNavigation
          value={activeTab}
          onChange={handleTabChange}
          sx={{
            bgcolor: COLORS.surface,
            height: 64,
            '& .MuiBottomNavigationAction-root': {
              minWidth: 'auto',
              px: 1,
              py: 1,
              '&.Mui-selected': {
                color: COLORS.primary,
                '& .MuiBottomNavigationAction-label': {
                  fontSize: '0.75rem',
                  fontWeight: 600,
                },
              },
              '& .MuiBottomNavigationAction-label': {
                fontSize: '0.7rem',
                mt: 0.5,
              },
            },
          }}
        >
          <BottomNavigationAction
            label="Home"
            icon={<HomeIcon sx={{ fontSize: 24 }} />}
          />
          <BottomNavigationAction
            label="Wallet"
            icon={<WalletIcon sx={{ fontSize: 24 }} />}
          />
          <BottomNavigationAction
            label="Manual"
            icon={<ManualIcon sx={{ fontSize: 24 }} />}
          />
        </BottomNavigation>
      </Paper>
    </Box>
  );
};

export default React.memo(MobileApp);