import React, { useEffect, useState } from 'react';
import { getCurrentUser } from './services/api';
import { User } from './types';
import { Login } from './pages/Login';
import { DashboardLayout } from './layouts/DashboardLayout';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const checkAuth = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'sans-serif',
        color: '#64748b'
      }}>
        Loading ReachInbox Email Scheduler...
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return <DashboardLayout user={user} onLogout={() => setUser(null)} />;
};

export default App;
