import React, { useState, useEffect } from 'react';
import { adminService } from '../services/adminService.js';
import { useToast } from '../context/ToastContext.jsx';
import {
  Activity,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Hash,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react';

const ACTIONS = [
  'All',
  'AUTH_LOGIN_SUCCESS',
  'AUTH_LOGIN_FAILED',
  'AUTH_LOGOUT',
  'DOC_UPLOAD',
  'DOC_METADATA_UPDATE',
  'DOC_DOWNLOAD',
  'DOC_PREVIEW',
  'DOC_DELETE',
  'DOC_ACCESS_DENIED',
  'ACL_GRANT',
  'ACL_REVOKE',
  'USER_STATUS_CHANGED',
  'SESSION_REVOKED',
  'AI_RECIPIENT_RECOMMENDATION',
  'AI_RECOMMENDATION_DECISION',
  'AUDIT_VERIFY',
];

export function AdminAudit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('All');
  const [outcomeFilter, setOutcomeFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });

  // Verification state
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  const { showToast } = useToast();

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 25,
      };
      if (search.trim()) params.search = search.trim();
      if (actionFilter !== 'All') params.action = actionFilter;
      if (outcomeFilter !== 'All') params.outcome = outcomeFilter;

      const res = await adminService.listAuditLogs(params);
      setLogs(res.logs || []);
      setPagination(res.pagination || { totalPages: 1, total: 0 });
    } catch (err) {
      showToast(err.message || 'Failed to fetch audit logs.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, outcomeFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleVerifyChain = async () => {
    try {
      setVerifying(true);
      const res = await adminService.verifyAuditChain();
      setVerificationResult(res.verification);

      if (res.verification?.isValid) {
        showToast(`Audit hash chain intact! ${res.verification.verifiedCount} events verified.`, 'success');
      } else {
        showToast('Audit chain tampering detected!', 'error');
      }
      fetchLogs();
    } catch (err) {
      showToast(err.message || 'Failed to verify audit chain.', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const getActionBadge = (action) => {
    if (action.includes('DENIED') || action.includes('FAILED')) {
      return 'bg-rose-950 text-rose-300 border-rose-800';
    }
    if (action.includes('GRANT') || action.includes('SUCCESS') || action.includes('VERIFY')) {
      return 'bg-emerald-950 text-emerald-300 border-emerald-800';
    }
    if (action.includes('UPLOAD') || action.includes('AI')) {
      return 'bg-brand-950 text-brand-300 border-brand-800';
    }
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-brand-400" />
            Tamper-Evident Audit Trail
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Append-only, SHA-256 hash-chained security event ledger with verification
          </p>
        </div>

        <button
          onClick={handleVerifyChain}
          disabled={verifying}
          className="px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:bg-slate-800 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
          {verifying ? 'Verifying Hashes...' : 'Verify Chain Integrity'}
        </button>
      </div>

      {/* Verification Status Banner if executed */}
      {verificationResult && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-4 shadow-lg ${
            verificationResult.isValid
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/40 border-rose-800 text-rose-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {verificationResult.isValid ? (
              <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <h3 className="text-sm font-bold">
                {verificationResult.isValid
                  ? 'Cryptographic Audit Chain Integrity Verified'
                  : 'Chain Tamper Detected! Hash Link Inconsistency'}
              </h3>
              <p className="text-xs opacity-90 mt-1 leading-relaxed">
                {verificationResult.message}
              </p>
              {verificationResult.lastEntryHash && (
                <p className="text-[11px] font-mono opacity-80 mt-1">
                  Head Hash: {verificationResult.lastEntryHash}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => setVerificationResult(null)}
            className="text-xs opacity-60 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by actor email, document title, reason, or event ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-brand-500 transition"
            >
              {ACTIONS.map((act) => (
                <option key={act} value={act}>
                  Action: {act}
                </option>
              ))}
            </select>

            <select
              value={outcomeFilter}
              onChange={(e) => {
                setOutcomeFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-brand-500 transition"
            >
              <option value="All">Outcome: All</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="DENIED">DENIED</option>
              <option value="FAILED">FAILED</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700"
            >
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/80 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Timestamp (UTC)</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Target / Document</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Entry Hash (SHA-256)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/40">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    Loading audit trail records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    No audit records match the selected criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.eventId} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono whitespace-nowrap">
                      {new Date(log.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${getActionBadge(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-300 font-mono">
                      {log.actorEmail}
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-300 max-w-xs truncate">
                      {log.documentTitle ? (
                        <div className="truncate font-medium">{log.documentTitle}</div>
                      ) : log.targetUserEmail ? (
                        <div className="text-slate-400 font-mono truncate">
                          Target: {log.targetUserEmail}
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">None</span>
                      )}
                      {log.reason && (
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {log.reason}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          log.outcome === 'SUCCESS'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : log.outcome === 'DENIED'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}
                      >
                        {log.outcome}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-xs font-mono text-slate-400 whitespace-nowrap">
                      <span
                        title={`Entry Hash: ${log.entryHash}\nPrev Hash: ${log.prevHash}`}
                        className="bg-slate-950 px-2 py-1 rounded border border-slate-800 cursor-help"
                      >
                        {log.entryHash ? log.entryHash.slice(0, 10) + '...' : 'GENESIS'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Page <span className="font-semibold text-slate-200">{page}</span> of{' '}
              <span className="font-semibold text-slate-200">{pagination.totalPages}</span> ({pagination.total} events)
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
