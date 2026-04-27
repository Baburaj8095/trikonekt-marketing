/**
 * useLoginContext.js
 * 
 * Custom hook to manage and access the dual-role login context.
 * Provides login mode (consumer vs team) and related utilities.
 * 
 * Usage:
 *   const { loginContext, role, isTeamMode, isConsumerMode, switchRole } = useLoginContext();
 */

import { useMemo, useCallback } from 'react';

export const useLoginContext = () => {
  // Get the current role from localStorage (namespaced)
  const role = useMemo(() => {
    try {
      return (
        localStorage.getItem('role_user') ||
        localStorage.getItem('role') ||
        'user'
      );
    } catch {
      return 'user';
    }
  }, []);

  // Get the login context (consumer or team)
  const loginContext = useMemo(() => {
    try {
      const ns = role || 'user';
      const context = localStorage.getItem(`login_context_${ns}`);
      // Default to consumer if not set
      return context || 'consumer';
    } catch {
      return 'consumer';
    }
  }, [role]);

  // Derived flags
  const isTeamMode = useMemo(() => loginContext === 'team', [loginContext]);
  const isConsumerMode = useMemo(() => loginContext === 'consumer', [loginContext]);

  // Get token
  const token = useMemo(() => {
    try {
      const ns = role || 'user';
      return localStorage.getItem(`token_${ns}`);
    } catch {
      return null;
    }
  }, [role]);

  // Get user data
  const user = useMemo(() => {
    try {
      const ns = role || 'user';
      const userData = localStorage.getItem(`user_${ns}`);
      return userData ? JSON.parse(userData) : null;
    } catch {
      return null;
    }
  }, [role]);

  // Switch login context and redirect
  const switchToTeam = useCallback(() => {
    try {
      const ns = role || 'user';
      localStorage.setItem(`login_context_${ns}`, 'team');
      // Could also auto-redirect here, but leaving to caller for flexibility
      window.location.href = '/team/genealogy';
    } catch (err) {
      console.error('Error switching to team mode:', err);
    }
  }, [role]);

  const switchToConsumer = useCallback(() => {
    try {
      const ns = role || 'user';
      localStorage.setItem(`login_context_${ns}`, 'consumer');
      // Could also auto-redirect here, but leaving to caller for flexibility
      window.location.href = '/user/dashboard2';
    } catch (err) {
      console.error('Error switching to consumer mode:', err);
    }
  }, [role]);

  // Utility to clear login context when logging out
  const clearLoginContext = useCallback(() => {
    try {
      const ns = role || 'user';
      localStorage.removeItem(`login_context_${ns}`);
    } catch (err) {
      console.error('Error clearing login context:', err);
    }
  }, [role]);

  return {
    // Core context
    loginContext,
    role,
    isTeamMode,
    isConsumerMode,
    
    // User data
    token,
    user,
    isAuthenticated: !!token,
    
    // Actions
    switchToTeam,
    switchToConsumer,
    clearLoginContext,
    
    // Utilities
    getNamespace: () => role || 'user',
    getStorageKey: (key) => `${key}_${role || 'user'}`,
  };
};

export default useLoginContext;
