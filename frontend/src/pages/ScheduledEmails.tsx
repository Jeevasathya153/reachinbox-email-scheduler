import React, { useState } from 'react';
import { EmailRecord } from '../types';
import { updateScheduledEmailTimeApi } from '../services/api';
import { Clock, Edit3, Check, X } from 'lucide-react';

interface ScheduledEmailsProps {
  emails: EmailRecord[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export const ScheduledEmails: React.FC<ScheduledEmailsProps> = ({ emails, loading, error, onRefresh }) => {
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [newStartTime, setNewStartTime] = useState<string>('');
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const handleStartEdit = (email: EmailRecord) => {
    setEditingEmailId(email.id);
    const existingDate = new Date(email.scheduled_at);
    // Format to local ISO datetime-local string format
    const localIso = new Date(existingDate.getTime() - existingDate.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setNewStartTime(localIso);
    setEditError(null);
  };

  const handleSaveEdit = async (emailId: string) => {
    if (!newStartTime) return;
    setEditLoading(true);
    setEditError(null);
    try {
      await updateScheduledEmailTimeApi(emailId, new Date(newStartTime).toISOString());
      setEditingEmailId(null);
      onRefresh();
    } catch (err: any) {
      setEditError(err.response?.data?.error || err.message || 'Failed to update time');
    } finally {
      setEditLoading(false);
    }
  };

  if (loading && emails.length === 0) {
    return <div style={{ padding: '24px', color: '#64748b' }}>Loading scheduled emails...</div>;
  }

  if (error && emails.length === 0) {
    return <div style={{ padding: '24px', color: '#dc2626' }}>{error}</div>;
  }

  if (emails.length === 0) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
        <Clock size={36} style={{ marginBottom: '12px', color: '#cbd5e1' }} />
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#334155' }}>No Scheduled Emails</h3>
        <p style={{ fontSize: '13px', marginTop: '4px' }}>Click "Compose" to schedule your first batch of emails.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      {emails.map((email) => (
        <div key={email.id} className="email-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="email-info">
              <span className="email-recipient">To: {email.recipient_email}</span>
              <div className="email-subject-body">
                <span className="email-subject">{email.subject}</span>
                <span>-</span>
                <span>{email.body.length > 60 ? email.body.substring(0, 60) + '...' : email.body}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: '#fef3c7',
                color: '#d97706',
                padding: '4px 10px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Clock size={12} />
                {new Date(email.scheduled_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>

              <button
                onClick={() => handleStartEdit(email)}
                style={{
                  background: 'none',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Edit Scheduled Time"
              >
                <Edit3 size={12} /> Edit Time
              </button>

              <span className={`status-pill ${email.status}`}>
                {email.status}
              </span>
            </div>
          </div>

          {/* Time Edit Inline Popover */}
          {editingEmailId === email.id && (
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '4px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>New Scheduled Start Time:</span>
                <input
                  type="datetime-local"
                  className="input-control"
                  style={{ width: '220px', padding: '4px 8px', fontSize: '13px' }}
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                />
                {editError && <span style={{ color: '#dc2626', fontSize: '12px' }}>{editError}</span>}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setEditingEmailId(null)}
                  style={{ background: 'none', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                >
                  <X size={12} /> Cancel
                </button>
                <button
                  onClick={() => handleSaveEdit(email.id)}
                  disabled={editLoading}
                  style={{ backgroundColor: '#00b87c', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                >
                  <Check size={12} /> {editLoading ? 'Saving...' : 'Save New Time'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
