import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Shield, Lock, Mail, ArrowRight, UserCheck, ShieldAlert, EyeOff, Chrome } from 'lucide-react';
import { isFirebaseConfigured } from '../config/firebase.js';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, loginWithGoogle } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
      showToast('Welcome back! Session established securely.', 'success');
      navigate('/documents');
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle('viewer');
      showToast('Signed in with Google successfully!', 'success');
      navigate('/documents');
    } catch (err) {
      setError(err.message || 'Google Sign-In failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 shadow-xl shadow-brand-500/25 mb-4">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Trust<span className="text-brand-400">Vault</span> Access Portal
        </h1>
        <p className="mt-1.5 text-xs text-slate-400">
          Zero-trust authenticated session with revocable server-side tokens
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@trustvault.local"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-500 transition font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 text-sm font-semibold rounded-lg bg-brand-600 hover:bg-brand-500 text-white transition shadow-lg shadow-brand-500/20 disabled:bg-slate-800 disabled:text-slate-500 flex items-center justify-center gap-2"
            >
              {loading ? (
                'Authenticating...'
              ) : (
                <>
                  Sign In <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Google / Firebase Sign-In */}
          <div className="mt-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-[11px]">
                <span className="bg-slate-900 px-3 text-slate-500 uppercase tracking-wider font-semibold">
                  or continue with
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
              className="mt-3 w-full py-2.5 px-4 text-sm font-semibold rounded-lg bg-slate-950 border border-slate-700 hover:border-slate-500 text-slate-200 transition flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {googleLoading ? (
                <span className="text-slate-400">Connecting to Google…</span>
              ) : (
                <>
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in with Google
                  {!isFirebaseConfigured() && (
                    <span className="ml-1 text-[10px] text-slate-500 font-normal">(demo mode)</span>
                  )}
                </>
              )}
            </button>
          </div>

          {/* Quick Demo Switcher */}
          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center mb-2.5">
              Instant Demo Credentials (Click to fill)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@trustvault.local', 'Admin@TrustVault2026!')}
                className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-rose-700/60 text-left transition group"
              >
                <div className="flex items-center gap-1.5 text-rose-400 font-semibold text-xs">
                  <ShieldAlert className="w-3.5 h-3.5" /> Admin
                </div>
                <div className="text-[10px] text-slate-500 truncate font-mono">admin@trustvault.local</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('owner@trustvault.local', 'Owner@TrustVault2026!')}
                className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-700/60 text-left transition group"
              >
                <div className="flex items-center gap-1.5 text-indigo-400 font-semibold text-xs">
                  <Shield className="w-3.5 h-3.5" /> Owner (Alice)
                </div>
                <div className="text-[10px] text-slate-500 truncate font-mono">owner@trustvault.local</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('viewer@trustvault.local', 'Viewer@TrustVault2026!')}
                className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-700/60 text-left transition group"
              >
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                  <UserCheck className="w-3.5 h-3.5" /> Viewer (Bob)
                </div>
                <div className="text-[10px] text-slate-500 truncate font-mono">viewer@trustvault.local</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('disabled@trustvault.local', 'Disabled@TrustVault2026!')}
                className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-700/60 text-left transition group"
              >
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs">
                  <EyeOff className="w-3.5 h-3.5" /> Suspended (Dave)
                </div>
                <div className="text-[10px] text-slate-500 truncate font-mono">disabled@trustvault.local</div>
              </button>
            </div>
          </div>

          <div className="mt-5 text-center">
            <p className="text-xs text-slate-400">
              Need a new account?{' '}
              <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium">
                Register here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
