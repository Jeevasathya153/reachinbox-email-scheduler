import React, { useEffect, useState } from 'react';
import { getSlackStatusApi, disconnectSlackApi } from '../services/api';
import { SlackStatus } from '../types';
import { Slack, CheckCircle, Link } from 'lucide-react';

export const SlackConnectBanner: React.FC = () => {
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchStatus = async () => {
    try {
      const data = await getSlackStatusApi();
      setStatus(data);
    } catch (err) {
      setStatus({ connected: false, channel: null });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleConnect = () => {
    window.location.href = '/api/slack/connect';
  };

  const handleDisconnect = async () => {
    try {
      await disconnectSlackApi();
      await fetchStatus();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return null;

  return (
    <div style={{
      marginTop: 'auto',
      padding: '12px',
      backgroundColor: status?.connected ? '#f0fdf4' : '#f8fafc',
      border: `1px solid ${status?.connected ? '#bbf7d0' : '#e2e8f0'}`,
      borderRadius: '8px',
      fontSize: '13px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <Slack size={16} color={status?.connected ? '#16a34a' : '#64748b'} />
        <span style={{ fontWeight: 600, color: status?.connected ? '#15803d' : '#334155' }}>
          Slack Integration
        </span>
      </div>

      {status?.connected ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#166534', fontSize: '12px', marginBottom: '8px' }}>
            <CheckCircle size={14} /> Connected to {status.channel || '#general'}
          </div>
          <button
            onClick={handleDisconnect}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#dc2626',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0
            }}
          >
            Disconnect Slack
          </button>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
            Get alerts when hourly send limit is reached.
          </p>
          <button
            onClick={handleConnect}
            style={{
              width: '100%',
              padding: '6px 10px',
              backgroundColor: '#4A154B',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Link size={14} /> Connect Slack
          </button>
        </div>
      )}
    </div>
  );
};
