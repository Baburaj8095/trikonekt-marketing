/**
 * LoginContextHeader.jsx
 * 
 * Header component that displays current login mode and allows switching.
 * Can be integrated into existing header layouts.
 * 
 * Features:
 * - Shows current mode (Consumer/Team)
 * - Provides quick switch button
 * - Logout option
 */

import React from 'react';
import { Box, Button, Menu, MenuItem, Typography, Chip, Avatar } from '@mui/material';
import { ArrowDropDown, Logout, SwapHoriz } from '@mui/icons-material';
import useLoginContext from '../hooks/useLoginContext';

export const LoginContextHeader = () => {
  const { loginContext, isTeamMode, isConsumerMode, user, switchToTeam, switchToConsumer, clearLoginContext } = useLoginContext();
  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleLogout = () => {
    clearLoginContext();
    // Clear all auth tokens
    try {
      localStorage.removeItem('token_user');
      localStorage.removeItem('refresh_user');
      localStorage.removeItem('role_user');
      localStorage.removeItem('user_user');
      localStorage.removeItem('login_context_user');
    } catch (_) {}
    window.location.href = '/v2/login/user';
  };

  const handleSwitchRole = () => {
    if (isTeamMode) {
      switchToConsumer();
    } else {
      switchToTeam();
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        background: '#FFFFFF',
        borderRadius: 1,
        border: '1px solid #E5E7EB',
      }}
    >
      {/* Current Mode Indicator */}
      <Chip
        label={isTeamMode ? '🌳 Team Mode' : '👤 Consumer Mode'}
        color={isTeamMode ? 'primary' : 'default'}
        variant="outlined"
        size="small"
        sx={{
          fontWeight: 600,
          borderColor: isTeamMode ? '#FF7B00' : '#E5E7EB',
          color: isTeamMode ? '#FF7B00' : '#6B7280',
        }}
      />

      {/* Switch Role Button */}
      <Button
        size="small"
        startIcon={<SwapHoriz />}
        onClick={handleSwitchRole}
        sx={{
          color: '#FF7B00',
          fontWeight: 600,
          textTransform: 'none',
          '&:hover': {
            background: 'rgba(255, 123, 0, 0.08)',
          }
        }}
      >
        Switch to {isTeamMode ? 'Consumer' : 'Team'}
      </Button>

      {/* User Menu */}
      <Box sx={{ ml: 'auto' }}>
        <Button
          onClick={(e) => setAnchorEl(e.currentTarget)}
          endIcon={<ArrowDropDown />}
          sx={{
            color: '#111827',
            textTransform: 'none',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            '&:hover': { background: '#F3F4F6' }
          }}
        >
          <Avatar
            sx={{
              width: 32,
              height: 32,
              background: '#FF7B00',
              fontSize: 14,
              fontWeight: 700
            }}
          >
            {user?.full_name?.charAt(0) || 'U'}
          </Avatar>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
            {user?.full_name || 'User'}
          </Typography>
        </Button>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
        >
          <MenuItem disabled>
            {user?.username || 'Account'}
          </MenuItem>
          <MenuItem divider onClick={() => {
            setAnchorEl(null);
            window.location.href = isTeamMode ? '/team/profile' : '/user/profile';
          }}>
            Profile
          </MenuItem>
          <MenuItem onClick={() => {
            setAnchorEl(null);
            handleLogout();
          }} sx={{ color: '#dc2626' }}>
            <Logout fontSize="small" sx={{ mr: 1 }} />
            Logout
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
};

/**
 * ModeIndicator - Simple indicator without menu
 * Shorter version for navbar integration
 */
export const ModeIndicator = () => {
  const { isTeamMode } = useLoginContext();

  return (
    <Box
      sx={{
        fontSize: 11,
        fontWeight: 700,
        color: '#FF7B00',
        background: '#FFF8EF',
        padding: '4px 12px',
        borderRadius: 99,
        whiteSpace: 'nowrap',
      }}
    >
      {isTeamMode ? '🌳 Team' : '👤 Consumer'}
    </Box>
  );
};

/**
 * SwitchRoleButton - Button to switch between roles
 */
export const SwitchRoleButton = () => {
  const { isTeamMode, switchToTeam, switchToConsumer } = useLoginContext();

  return (
    <Button
      onClick={isTeamMode ? switchToConsumer : switchToTeam}
      size="small"
      variant="outlined"
      sx={{
        borderColor: '#FF7B00',
        color: '#FF7B00',
        fontWeight: 600,
        textTransform: 'none',
        '&:hover': {
          background: 'rgba(255, 123, 0, 0.08)',
          borderColor: '#FF7B00',
        }
      }}
    >
      {isTeamMode ? '← Back to Consumer' : 'Go to Team →'}
    </Button>
  );
};

export default LoginContextHeader;
