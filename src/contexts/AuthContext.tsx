import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, envValidation } from '../lib/firebase';
import {
  fetchUserProfile,
  formatAuthErrorMessage,
  loginWithEmail,
  logoutUser,
} from '../services/authService';
import type { UserProfile } from '../types';

export type AuthStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'inactive'
  | 'no_profile'
  | 'config_error';

export interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  status: AuthStatus;
  authError: string | null;
  loading: boolean;
  isAdmin: boolean;
  isSales: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  refetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<AuthStatus>(
    envValidation.isConfigured ? 'loading' : 'config_error'
  );
  const [authError, setAuthError] = useState<string | null>(
    envValidation.isConfigured
      ? null
      : `Missing configuration: ${envValidation.missingKeys.join(', ')} in .env.local`
  );
  const [loading, setLoading] = useState<boolean>(envValidation.isConfigured);

  const loadUserProfile = useCallback(async (firebaseUser: User) => {
    try {
      const userProfile = await fetchUserProfile(firebaseUser.uid);

      if (!userProfile) {
        setProfile(null);
        setStatus('no_profile');
        setAuthError(
          `User record (${firebaseUser.email}) not found in database. Contact administrator to set up users/${firebaseUser.uid}.`
        );
        return;
      }

      setProfile(userProfile);

      if (!userProfile.active) {
        setStatus('inactive');
        setAuthError(
          'Your account is deactivated. Access to RR Metal Roofing quotation system is restricted.'
        );
      } else {
        setStatus('authenticated');
        setAuthError(null);
      }
    } catch (err: unknown) {
      console.error('[AuthContext] Error loading user profile:', err);
      const firebaseError = err as { code?: string; message?: string };
      if (firebaseError.code === 'permission-denied') {
        setStatus('inactive');
        setAuthError(
          'Your account is deactivated. Access to RR Metal Roofing is restricted by security rules.'
        );
      } else {
        setStatus('no_profile');
        const errMessage = err instanceof Error ? err.message : 'Failed to retrieve user profile';
        setAuthError(`Profile load error: ${errMessage}. Verify Firestore rules and connection.`);
      }
    }
  }, []);

  useEffect(() => {
    if (!envValidation.isConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoading(true);
        await loadUserProfile(currentUser);
        setLoading(false);
      } else {
        setProfile(null);
        setStatus('unauthenticated');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [loadUserProfile]);

  const login = async (email: string, pass: string): Promise<boolean> => {
    if (!envValidation.isConfigured) {
      setAuthError('Cannot sign in: Firebase configuration is missing.');
      return false;
    }

    setLoading(true);
    setAuthError(null);

    try {
      const cred = await loginWithEmail(email, pass);
      setUser(cred.user);
      await loadUserProfile(cred.user);
      return true;
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      const friendlyMessage = formatAuthErrorMessage(firebaseError.code || '');
      setAuthError(friendlyMessage);
      setStatus('unauthenticated');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await logoutUser();
      setUser(null);
      setProfile(null);
      setStatus('unauthenticated');
      setAuthError(null);
    } catch (err: unknown) {
      console.error('[AuthContext] Error signing out:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setAuthError(null);
  };

  const refetchProfile = async () => {
    if (user) {
      setLoading(true);
      await loadUserProfile(user);
      setLoading(false);
    }
  };

  const isAdmin = profile?.role === 'admin' && profile?.active === true;
  const isSales = profile?.role === 'sales' && profile?.active === true;

  const value: AuthContextValue = {
    user,
    profile,
    status,
    authError,
    loading,
    isAdmin,
    isSales,
    login,
    logout,
    clearError,
    refetchProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
