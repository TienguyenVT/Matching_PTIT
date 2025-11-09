'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/client';
import { UserProfile } from '@/lib/auth-helpers.client';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: 'admin' | 'user' | null;
  loading: boolean;
  error: Error | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  role: null,
  loading: true,
  error: null,
  refreshProfile: async () => {},
});

// Cache keys for localStorage
const CACHE_KEYS = {
  USER: 'cached_user',
  PROFILE: 'cached_profile',
  TIMESTAMP: 'cache_timestamp',
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const supabase = supabaseBrowser();

  // Load from cache first
  const loadFromCache = useCallback(() => {
    try {
      const timestamp = localStorage.getItem(CACHE_KEYS.TIMESTAMP);
      if (timestamp && Date.now() - parseInt(timestamp) < CACHE_DURATION) {
        const cachedUser = localStorage.getItem(CACHE_KEYS.USER);
        const cachedProfile = localStorage.getItem(CACHE_KEYS.PROFILE);
        
        if (cachedUser && cachedProfile) {
          setUser(JSON.parse(cachedUser));
          setProfile(JSON.parse(cachedProfile));
          return true;
        }
      }
    } catch (e) {
      console.error('[AuthProvider] Cache load error:', e);
    }
    return false;
  }, []);

  // Save to cache
  const saveToCache = useCallback((user: User | null, profile: UserProfile | null) => {
    try {
      if (user && profile) {
        localStorage.setItem(CACHE_KEYS.USER, JSON.stringify(user));
        localStorage.setItem(CACHE_KEYS.PROFILE, JSON.stringify(profile));
        localStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now().toString());
      } else {
        localStorage.removeItem(CACHE_KEYS.USER);
        localStorage.removeItem(CACHE_KEYS.PROFILE);
        localStorage.removeItem(CACHE_KEYS.TIMESTAMP);
      }
    } catch (e) {
      console.error('[AuthProvider] Cache save error:', e);
    }
  }, []);

  // Fetch profile data
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, username, role, created_at')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      // Cast role to string for enum handling
      if (data?.role) {
        data.role = String(data.role);
      }
      
      return data as UserProfile;
    } catch (err) {
      console.error('[AuthProvider] Error fetching profile:', err);
      setError(err as Error);
      return null;
    }
  }, [supabase]);

  // Refresh profile manually
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    
    const newProfile = await fetchProfile(user.id);
    if (newProfile) {
      setProfile(newProfile);
      saveToCache(user, newProfile);
    }
  }, [user, fetchProfile, saveToCache]);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // Try loading from cache first
        const cacheLoaded = loadFromCache();
        
        // Always verify with server, but don't block if cache exists
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        
        if (authError) throw authError;
        
        if (mounted) {
          if (authUser) {
            // Only fetch profile if not in cache or user changed
            if (!cacheLoaded || user?.id !== authUser.id) {
              const userProfile = await fetchProfile(authUser.id);
              if (mounted) {
                setUser(authUser);
                setProfile(userProfile);
                saveToCache(authUser, userProfile);
              }
            }
          } else {
            setUser(null);
            setProfile(null);
            saveToCache(null, null);
          }
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
          setLoading(false);
        }
      }
    };

    initAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log('[AuthProvider] Auth event:', event);
      
      if (session?.user) {
        const userProfile = await fetchProfile(session.user.id);
        if (mounted) {
          setUser(session.user);
          setProfile(userProfile);
          saveToCache(session.user, userProfile);
        }
      } else {
        setUser(null);
        setProfile(null);
        saveToCache(null, null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // Empty deps, only run once

  const role = profile?.role as 'admin' | 'user' | null;

  return (
    <AuthContext.Provider value={{ user, profile, role, loading, error, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// HOC for protected pages
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: { 
    requireAdmin?: boolean;
    redirectTo?: string;
  }
) {
  return function ProtectedComponent(props: P) {
    const { user, role, loading } = useAuth();
    const router = require('next/navigation').useRouter();
    
    useEffect(() => {
      if (!loading) {
        if (!user) {
          router.replace('/login');
        } else if (options?.requireAdmin && role !== 'admin') {
          router.replace(options?.redirectTo || '/home');
        }
      }
    }, [user, role, loading, router]);

    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500"></div>
        </div>
      );
    }

    if (!user || (options?.requireAdmin && role !== 'admin')) {
      return null;
    }

    return <Component {...props} />;
  };
}
