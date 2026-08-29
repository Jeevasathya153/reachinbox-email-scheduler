import React, { useState, useRef } from 'react';
import { scheduleEmailsApi } from '../services/api';
import { User } from '../types';
import { X, Upload, Clock, Trash2, Send } from 'lucide-react';

interface ComposeModalProps {
  user: User;
  onClose: () => void;
  onScheduledSuccess: () => void;
}

const toLocalDatetimeInputString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const ComposeModal: React.FC<ComposeModalProps> = ({ user, onClose, onScheduledSuccess }) => {
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [delayMs, setDelayMs] = useState<number>(2000);
  const [hourlyLimit, setHourlyLimit] = useState<number>(200);

  // Send Later Popover state initialized with local datetime string
  const [showSendLater, setShowSendLater] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<string>(toLocalDatetimeInputString(new Date(Date.now() + 60000)));

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fileMessage, setFileMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAddRecipient = (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (trimmed && !recipients.includes(trimmed)) {
      setRecipients([...recipients, trimmed]);
    }
  };

  const handleKeyDownRecipient = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddRecipient(recipientInput);
      setRecipientInput('');
    }
  };

  const handleRemoveRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        // Extract all email patterns from file text/CSV
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const matches = content.match(emailRegex) || [];
        const uniqueMatches = Array.from(new Set(matches.map((m) => m.toLowerCase())));

        if (uniqueMatches.length > 0) {
          const newSet = Array.from(new Set([...recipients, ...uniqueMatches]));
          setRecipients(newSet);
          setFileMessage(`${uniqueMatches.length} email addresses detected`);
        } else {
          setError('No valid email addresses found in uploaded file.');
        }
      }
    };
    reader.readAsText(file);
  };

  const handleScheduleSubmit = async () => {
    let finalRecipients = [...recipients];
    if (recipientInput.trim()) {
      const trimmed = recipientInput.trim().toLowerCase();
      if (!finalRecipients.includes(trimmed)) {
        finalRecipients.push(trimmed);
        setRecipients(finalRecipients);
        setRecipientInput('');
      }
    }

    if (finalRecipients.length === 0) {
      setError('Please add at least one recipient email.');
      return;
    }
    if (!subject.trim()) {
      setError('Please enter a subject for the email.');
      return;
    }
    if (!body.trim()) {
      setError('Please enter body text for the email.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await scheduleEmailsApi({
        recipients: finalRecipients,
        subject,
        body,
        startTime: new Date(startTime).toISOString(),
        delayBetweenEmails: Number(delayMs),
        hourlyLimit: Number(hourlyLimit),
      });

      onClose();
      onScheduledSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to schedule emails');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="compose-overlay">
      <div className="compose-card">
        {/* Header */}
        <div className="compose-header">
          <div className="compose-title">
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#64748b' }}
            >
              ←
            </button>
            Compose New Email
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => { setSubject(''); setBody(''); setRecipients([]); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              title="Clear Draft"
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={() => setShowSendLater(!showSendLater)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: showSendLater ? '#00b87c' : '#64748b' }}
              title="Send Later Options"
            >
              <Clock size={18} />
            </button>
            <button
              onClick={handleScheduleSubmit}
              disabled={loading}
              className="compose-btn"
              style={{ width: 'auto', padding: '6px 18px' }}
            >
              <Send size={14} /> {loading ? 'Scheduling...' : 'Send Later'}
            </button>
          </div>
        </div>

        {/* Body Form */}
        <div className="compose-body">
          {error && (
            <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {fileMessage && (
            <div style={{ backgroundColor: '#d1fae5', color: '#059669', padding: '8px 12px', borderRadius: '8px', fontSize: '12px' }}>
              {fileMessage}
            </div>
          )}

          {/* From */}
          <div className="field-group">
            <span className="field-label">From</span>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#334155' }}>
              {user.email}
            </div>
          </div>

          {/* To Recipients */}
          <div className="field-group" style={{ alignItems: 'flex-start' }}>
            <span className="field-label" style={{ paddingTop: '8px' }}>To</span>
            <div className="recipient-chips-area">
              {recipients.map((email, idx) => (
                <div key={idx} className="chip">
                  {email}
                  <span className="chip-remove" onClick={() => handleRemoveRecipient(idx)}>×</span>
                </div>
              ))}
              <input
                type="email"
                placeholder={recipients.length === 0 ? "Type email and press Enter..." : ""}
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={handleKeyDownRecipient}
                style={{ border: 'none', outline: 'none', fontSize: '13px', flex: 1, minWidth: '150px' }}
              />
              <button
                type="button"
                className="upload-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={12} /> Upload List
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv,.txt"
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* Subject */}
          <div className="field-group">
            <span className="field-label">Subject</span>
            <input
              type="text"
              className="input-control"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Configuration Settings */}
          <div className="config-row">
            <div className="config-item">
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Delay between 2 emails (ms):</span>
              <input
                type="number"
                className="input-control"
                style={{ width: '100px' }}
                value={delayMs}
                onChange={(e) => setDelayMs(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>
            <div className="config-item">
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Hourly Limit:</span>
              <input
                type="number"
                className="input-control"
                style={{ width: '100px' }}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          </div>

          {/* Send Later Popover Picker */}
          {showSendLater && (
            <div className="send-later-popover">
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>Send Later Options</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', color: '#64748b' }}>Scheduled Start Date & Time:</label>
                <input
                  type="datetime-local"
                  className="input-control"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowSendLater(false)}
                  style={{ background: 'none', border: '1px solid #cbd5e1', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Text Area Body Editor */}
          <textarea
            className="editor-textarea"
            placeholder="Type your email body here..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};
