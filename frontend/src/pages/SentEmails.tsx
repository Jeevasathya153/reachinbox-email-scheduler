import React from 'react';
import { EmailRecord } from '../types';
import { CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';

interface SentEmailsProps {
  emails: EmailRecord[];
  loading: boolean;
  error: string | null;
}

export const SentEmails: React.FC<SentEmailsProps> = ({ emails, loading, error }) => {
  if (loading && emails.length === 0) {
    return <div style={{ padding: '24px', color: '#64748b' }}>Loading sent emails...</div>;
  }

  if (error && emails.length === 0) {
    return <div style={{ padding: '24px', color: '#dc2626' }}>{error}</div>;
  }

  if (emails.length === 0) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
        <CheckCircle size={36} style={{ marginBottom: '12px', color: '#cbd5e1' }} />
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#334155' }}>No Sent Emails Yet</h3>
        <p style={{ fontSize: '13px', marginTop: '4px' }}>Ethereal test emails processed by the worker will appear here.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      {emails.map((email) => (
        <div key={email.id} className="email-row">
          <div className="email-info">
            <span className="email-recipient">To: {email.recipient_email}</span>
            <div className="email-subject-body">
              <span className="email-subject">{email.subject}</span>
              <span>-</span>
              <span>{email.body.length > 60 ? email.body.substring(0, 60) + '...' : email.body}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {email.ethereal_preview_url && (
              <a
                href={email.ethereal_preview_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: '#00b87c',
                  fontSize: '12px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#e6f7f2',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  border: '1px solid #00b87c'
                }}
              >
                <ExternalLink size={12} /> View Ethereal Mail
              </a>
            )}

            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {email.sent_at
                ? new Date(email.sent_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : new Date(email.updated_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>

            <span className={`status-pill ${email.status}`}>
              {email.status === 'sent' ? 'Sent' : email.status}
            </span>

            {email.failure_reason && (
              <span style={{ color: '#dc2626', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }} title={email.failure_reason}>
                <AlertTriangle size={14} /> Error
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
