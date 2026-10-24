import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Shield, ShieldAlert, LogOut, User as UserIcon, FileText, Settings, Activity } from 'lucide-react';

export function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleBadge = (role) => {
    if (role === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800">
          <ShieldAlert className="w-3 h-3" /> Admin
        </span>
      );
    }
    if (role === 'owner') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-950 text-indigo-300 border border-indigo-800">
          <Shield className="w-3 h-3" /> Owner
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
        <UserIcon className="w-3 h-3" /> Viewer
      </span>
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:scale-105 transition">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                  Trust<span className="text-brand-400">Vault</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">
                  Zero-Trust Sharing
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <Link
              to="/documents"
              className="px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-slate-400" />
              Documents
            </Link>

            {isAdmin && (
              <>
                <Link
                  to="/admin/audit"
                  className="px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5"
                >
                  <Activity className="w-4 h-4 text-slate-400" />
                  Audit Trail
                </Link>
                <Link
                  to="/admin/users"
                  className="px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  User Security
                </Link>
              </>
            )}
          </nav>

          {/* User profile & logout */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-semibold text-slate-200">{user.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                      {user.email}
                    </span>
                    {getRoleBadge(user.role)}
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition border border-transparent hover:border-slate-700"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-4 py-1.5 text-sm font-medium rounded-lg bg-brand-600 hover:bg-brand-500 text-white transition shadow-sm"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
