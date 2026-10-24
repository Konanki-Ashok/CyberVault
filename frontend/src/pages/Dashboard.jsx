import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { documentService } from '../services/documentService.js';
import { adminService } from '../services/adminService.js';
import { useToast } from '../context/ToastContext.jsx';
import {
  FileText,
  Upload,
  Shield,
  ShieldAlert,
  Users,
  Activity,
  CheckCircle2,
  Clock,
  ArrowRight,
  Eye,
  Lock,
} from 'lucide-react';
import { UploadModal } from '../components/UploadModal.jsx';
import { DocumentDetailModal } from '../components/DocumentDetailModal.jsx';

export function Dashboard() {
  const { user, isAdmin, isOwner } = useAuth();
  const { showToast } = useToast();

  const [documents, setDocuments] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch recent accessible documents
      const docsRes = await documentService.listDocuments({ limit: 5, sortBy: 'createdAt', order: 'desc' });
      setDocuments(docsRes.documents || []);

      // If admin, fetch system stats
      if (isAdmin) {
        const statsRes = await adminService.getStats();
        setAdminStats(statsRes.stats);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load dashboard data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isAdmin]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Welcome to TrustVault, {user?.name}
            </h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                isAdmin
                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                  : isOwner
                  ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              {user?.role}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            {isAdmin
              ? 'Security Administrator Console: Monitor system health, user sessions, and tamper-evident audit logs.'
              : isOwner
              ? 'Document Owner Vault: Securely store, manage ACL grants, and inspect access history.'
              : 'Secure Viewer Portal: Access documents explicitly shared with your account.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {(isOwner || isAdmin) && (
            <button
              onClick={() => setUploadModalOpen(true)}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-brand-600 hover:bg-brand-500 text-white transition flex items-center gap-2 shadow-lg shadow-brand-500/20"
            >
              <Upload className="w-4 h-4" /> Upload Document
            </button>
          )}

          <Link
            to="/documents"
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-2 border border-slate-700"
          >
            <FileText className="w-4 h-4 text-slate-400" /> Browse Vault
          </Link>
        </div>
      </div>

      {/* Admin Specific Stat Cards */}
      {isAdmin && adminStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Users</span>
              <Users className="w-4 h-4 text-brand-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{adminStats.totalUsers}</div>
            <p className="text-xs text-slate-500">
              {adminStats.activeSessions} active authenticated session(s)
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Documents</span>
              <FileText className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{adminStats.totalDocs}</div>
            <p className="text-xs text-slate-500">Across {adminStats.categoryStats?.length || 0} categories</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Audit Trail</span>
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">{adminStats.totalAuditLogs}</div>
            <p className="text-xs text-slate-500">
              {adminStats.recentActivityCount} events in the past 24h
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Denied Accesses</span>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400">{adminStats.deniedAttempts}</div>
            <p className="text-xs text-slate-500">Logged security boundary enforcements</p>
          </div>
        </div>
      )}

      {/* Recent Accessible Documents */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Recently Accessible Documents
            </h2>
          </div>
          <Link
            to="/documents"
            className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1 transition"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 mx-auto flex items-center justify-center text-slate-500">
              <Lock className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-300">No documents found in your library</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Documents you upload or that are shared with your email will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                className="px-6 py-4 hover:bg-slate-800/50 transition cursor-pointer flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-brand-400 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100 truncate">{doc.title}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span className="font-mono">{doc.originalFilename}</span>
                      <span>•</span>
                      <span>{(doc.size / 1024).toFixed(1)} KB</span>
                      <span>•</span>
                      <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-medium hidden sm:inline">
                    {doc.category}
                  </span>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-md font-semibold ${
                      doc.myPermission === 'owner'
                        ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                        : doc.myPermission === 'edit'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {doc.myPermission?.toUpperCase()}
                  </span>
                  <Eye className="w-4 h-4 text-slate-500 hover:text-slate-200" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadSuccess={() => {
          fetchData();
        }}
      />

      <DocumentDetailModal
        documentId={selectedDocId}
        isOpen={!!selectedDocId}
        onClose={() => setSelectedDocId(null)}
        onDocumentUpdated={fetchData}
        onDocumentDeleted={fetchData}
        currentUser={user}
      />
    </div>
  );
}
