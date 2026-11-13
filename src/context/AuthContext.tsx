import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { UserProfile } from '../types/index.ts';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  guestId: string;
  persona: { name: string; bio: string };
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  setPersona: (p: { name: string; bio: string }) => void;
  savePersonaToCloud: (name: string, bio: string) => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<UserProfile>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestId, setGuestId] = useState<string>('guest_' + Math.random().toString(36).substring(2, 9));
  const [persona, setPersona] = useState<{ name: string; bio: string }>({
    name: 'Adventurer',
    bio: 'A curious traveler seeking stories across worlds.',
  });

  // Load or generate guest ID & local persona
  useEffect(() => {
    const savedGuest = localStorage.getItem('palace_guest_id');
    if (savedGuest) {
      setGuestId(savedGuest);
    } else {
      const newGuest = 'guest_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('palace_guest_id', newGuest);
      setGuestId(newGuest);
    }

    const savedPersona = localStorage.getItem('palace_persona');
    if (savedPersona) {
      try {
        setPersona(JSON.parse(savedPersona));
      } catch {
        // ignore
      }
    }
  }, []);

  // Sync Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          const res = await fetch('/api/user/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.user) {
              setProfile(data.user);
              if (data.user.personaName) {
                setPersona({
                  name: data.user.personaName,
                  bio: data.user.personaBio || '',
                });
              }
            }
          }
        } catch (err) {
          console.error('Error syncing user with backend:', err);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (error) {
      console.error('Google Sign-In failed:', error);
      throw error;
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
      setProfile(null);
    } catch (error) {
      console.error('Sign-Out failed:', error);
    }
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken();
  };

  const savePersonaToCloud = async (name: string, bio: string) => {
    setPersona({ name, bio });
    localStorage.setItem('palace_persona', JSON.stringify({ name, bio }));

    if (user) {
      try {
        const token = await getIdToken();
        await fetch('/api/user/persona', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ personaName: name, personaBio: bio }),
        });
      } catch (err) {
        console.error('Failed to sync persona to cloud:', err);
      }
    }
  };

  const refreshProfile = async () => {
    try {
      const token = await getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/user/profile', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setProfile(data.user);
        }
      }
    } catch (err) {
      console.error('refreshProfile failed:', err);
    }
  };

  const updateProfile = async (data: Partial<UserProfile>): Promise<UserProfile> => {
    const token = await getIdToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/user/profile', {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to update profile');
    }

    const resData = await res.json();
    setProfile(resData.user);
    return resData.user;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        guestId,
        persona,
        signInWithGoogle,
        signOutUser,
        getIdToken,
        setPersona,
        savePersonaToCloud,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
