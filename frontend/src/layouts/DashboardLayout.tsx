import React, { useState, useEffect } from 'react';
import { User, EmailRecord } from '../types';
import {
  getScheduledEmailsApi,
  getSentEmailsApi,
  searchEmailsApi,
  logoutUser,
} from '../services/api';
import { ScheduledEmails } from '../pages/ScheduledEmails';
import { SentEmails } from '../pages/SentEmails';
import { ComposeModal } from '../components/ComposeModal';
import { SlackConnectBanner } from '../components/SlackConnectBanner';
import { Plus, Search, LogOut, Clock, CheckCircle, ExternalLink } from 'lucide-react';

interface DashboardLayoutProps {
  user: User;
  onLogout: () => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [scheduledEmails, setScheduledEmails] = useState<EmailRecord[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailRecord[]>([]);
  const [searchResults, setSearchResults] = useState<EmailRecord[] | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showCompose, setShowCompose] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [scheduledData, sentData] = await Promise.all([
        getScheduledEmailsApi(),
        getSentEmailsApi(),
      ]);
      setScheduledEmails(scheduledData);
      setSentEmails(sentData);
    } catch (err: any) {
      setError('Failed to fetch emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults(null);
      return;
    }

    try {
      const results = await searchEmailsApi(val);
      setSearchResults(results);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogoutClick = async () => {
    await logoutUser();
    onLogout();
  };

  const displayedEmails = searchResults
    ? searchResults
    : activeTab === 'scheduled'
    ? scheduledEmails
    : sentEmails;

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        {/* Brand Logo */}
        <div className="logo-header">
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            backgroundColor: '#00b87c',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            fontWeight: 800
          }}>
            R
          </div>
          ReachInbox
        </div>

        {/* User Profile Pill */}
        <div className="user-profile-card">
          <img
            src={user.avatar || user.avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'}
            alt={user.name}
            className="user-avatar"
          />
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user.name}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user.email}
            </div>
          </div>
        </div>

        {/* Compose Button */}
        <button className="compose-btn" onClick={() => setShowCompose(true)}>
          <Plus size={18} /> Compose
        </button>

        {/* Navigation Items */}
        <ul className="nav-list">
          <li
            className={`nav-item ${activeTab === 'scheduled' && !searchResults ? 'active' : ''}`}
            onClick={() => { setActiveTab('scheduled'); setSearchResults(null); setSearchQuery(''); }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} /> Scheduled
            </span>
            <span className="nav-badge">{scheduledEmails.length}</span>
          </li>
          <li
            className={`nav-item ${activeTab === 'sent' && !searchResults ? 'active' : ''}`}
            onClick={() => { setActiveTab('sent'); setSearchResults(null); setSearchQuery(''); }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={16} /> Sent
            </span>
            <span className="nav-badge">{sentEmails.length}</span>
          </li>

          {/* BullMQ Live Dashboard Link */}
          <a
            href="/admin/queues"
            target="_blank"
            rel="noreferrer"
            className="nav-item"
            style={{ textDecoration: 'none', color: '#475569', marginTop: '12px' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ExternalLink size={16} /> BullMQ Dashboard
            </span>
          </a>
        </ul>


        {/* Logout Button */}
        <button
          onClick={handleLogoutClick}
          style={{
            marginTop: '8px',
            padding: '8px 12px',
            backgroundColor: 'transparent',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            color: '#64748b',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <LogOut size={14} /> Logout
        </button>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        {/* Header Bar */}
        <div className="top-bar">
          <div className="search-box">
            <Search size={16} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search recipient, sender, subject..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>

          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
            {searchResults ? `Search Results (${searchResults.length})` : activeTab === 'scheduled' ? 'Scheduled Emails' : 'Sent Emails'}
          </div>
        </div>

        {/* Content Table View */}
        {searchResults ? (
          activeTab === 'scheduled' ? (
            <ScheduledEmails emails={searchResults.filter(e => e.status === 'scheduled' || e.status === 'processing')} loading={loading} error={error} onRefresh={loadData} />
          ) : (
            <SentEmails emails={searchResults.filter(e => e.status === 'sent' || e.status === 'failed')} loading={loading} error={error} />
          )
        ) : activeTab === 'scheduled' ? (
          <ScheduledEmails emails={scheduledEmails} loading={loading} error={error} onRefresh={loadData} />
        ) : (
          <SentEmails emails={sentEmails} loading={loading} error={error} />
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <ComposeModal
          user={user}
          onClose={() => setShowCompose(false)}
          onScheduledSuccess={loadData}
        />
      )}
    </div>
  );
};
