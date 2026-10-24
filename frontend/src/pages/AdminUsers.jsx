import React, { useState, useEffect } from 'react';
import { adminService } from '../services/adminService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import {
  Users,
  Shield,
  ShieldAlert,
  UserCheck,
  UserX,
  LogOut,
  Clock,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';

export function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState(null); // { type: 'status' | 'revoke', user }
  const [actionLoading, setActionLoading] = useState(false);

  const { user: currentAdmin } = useAuth();
  const { showToast } = useToast();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await adminService.listUsers();
      setUsers(res.users || []);
    } catch (err) {
      showToast(err.message || 'Failed to load user directory.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async () => {
    if (!confirmTarget || confirmTarget.type !== 'status') return;
    const target = confirmTarget.user;
    const nextStatus = target.status === 'active' ? 'disabled' : 'active';

    try {
      setActionLoading(true);
      await adminService.updateUserStatus(target._id, nextStatus);
      showToast(`Account status updated to ${nextStatus}. ${nextStatus === 'disabled' ? 'All active sessions invalidated.' : ''}`, 'success');
      setConfirmTarget(null);
      fetchUsers();
    } catch (err) {
      showToast(err.message || 'Failed to update user status.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeSessions = async () => {
    if (!confirmTarget || confirmTarget.type !== 'revoke') return;
    const target = confirmTarget.user;

    try {
      setActionLoading(true);
      const res = await adminService.revokeUserSessions(target._id);
      showToast(res.message || 'All sessions revoked.', 'success');
      setConfirmTarget(null);
      fetchUsers();
    } catch (err) {
      showToast(err.message || 'Failed to revoke sessions.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-brand-400" />
          User & Session Management
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Account state enforcement, role administration, and instant session revocation
        </p>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/80 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Documents Owned</th>
                <th className="px-4 py-3">Active Sessions</th>
                <th className="px-4 py-3 text-right">Security Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/40">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSelf = u._id === currentAdmin?.id;

                  return (
                    <tr key={u._id} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-200">{u.name}</div>
                        <div className="text-xs text-slate-400 font-mono">{u.email}</div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded font-semibold uppercase ${
                            u.role === 'admin'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : u.role === 'owner'
                              ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded font-semibold inline-flex items-center gap-1 ${
                            u.status === 'active'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}
                        >
                          {u.status === 'active' ? (
                            <>
                              <UserCheck className="w-3 h-3" /> Active
                            </>
                          ) : (
                            <>
                              <UserX className="w-3 h-3" /> Disabled
                            </>
                          )}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-300 font-medium">
                        {u.documentsCount} document(s)
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-300 font-medium">
                        {u.activeSessionsCount} active
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setConfirmTarget({ type: 'revoke', user: u })}
                            disabled={u.activeSessionsCount === 0}
                            title="Invalidate all active sessions"
                            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition"
                          >
                            Revoke Sessions
                          </button>

                          <button
                            onClick={() => setConfirmTarget({ type: 'status', user: u })}
                            disabled={isSelf}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                              u.status === 'active'
                                ? 'bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800'
                                : 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800'
                            } disabled:opacity-40`}
                          >
                            {u.status === 'active' ? 'Disable Account' : 'Enable Account'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={confirmTarget?.type === 'status'}
        title={confirmTarget?.user?.status === 'active' ? 'Disable User Account' : 'Enable User Account'}
        message={
          confirmTarget?.user?.status === 'active'
            ? `Are you sure you want to disable ${confirmTarget?.user?.email}? When disabled, all active sessions are immediately invalidated and the user will be blocked on all subsequent requests.`
            : `Re-enable account for ${confirmTarget?.user?.email}? The user will be permitted to authenticate and access their vault again.`
        }
        confirmText={confirmTarget?.user?.status === 'active' ? 'Disable Account' : 'Enable Account'}
        isDanger={confirmTarget?.user?.status === 'active'}
        onConfirm={handleToggleStatus}
        onCancel={() => setConfirmTarget(null)}
        loading={actionLoading}
      />

      <ConfirmDialog
        isOpen={confirmTarget?.type === 'revoke'}
        title="Revoke All User Sessions"
        message={`Immediately terminate all active login sessions for ${confirmTarget?.user?.email}? The user will be required to re-authenticate with their credentials.`}
        confirmText="Revoke All Sessions"
        isDanger={true}
        onConfirm={handleRevokeSessions}
        onCancel={() => setConfirmTarget(null)}
        loading={actionLoading}
      />
    </div>
  );
}
