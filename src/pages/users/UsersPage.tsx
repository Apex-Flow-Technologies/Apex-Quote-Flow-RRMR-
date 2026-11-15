import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  listUsers,
  createStaffUser,
  updateStaffUser,
  sendPasswordReset,
  formatUserAdminError,
} from '../../services/userService';
import type { UserProfile, UserRole } from '../../types/user';
import { Users, Plus, KeyRound, Power, X, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

const inputCls =
  'w-full h-11 px-3 rounded-control border border-line-strong bg-white text-sm text-ink focus:border-brand';

export const UsersPage: React.FC = () => {
  const { isAdmin, user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'sales' as UserRole });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setUsers(await listUsers());
    } catch (err) {
      setMessage({ type: 'error', text: formatUserAdminError(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="p-6 text-sm text-muted">Only administrators can manage users.</div>
    );
  }

  const run = async (uid: string, fn: () => Promise<void>, ok: string) => {
    try {
      setBusyUid(uid);
      setMessage(null);
      await fn();
      setMessage({ type: 'ok', text: ok });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: formatUserAdminError(err) });
    } finally {
      setBusyUid(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) return setFormError('Enter the staff member’s name.');
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setFormError('Enter a valid email address.');
    if (form.password.length < 8) return setFormError('Use a temporary password of at least 8 characters.');
    try {
      setSaving(true);
      await createStaffUser(form);
      setAdding(false);
      setForm({ name: '', email: '', password: '', role: 'sales' });
      setMessage({ type: 'ok', text: `${form.name.trim()} can now sign in with ${form.email.trim()}.` });
      await load();
    } catch (err) {
      setFormError(formatUserAdminError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
            <Users className="w-6 h-6 text-brand" /> Users
          </h1>
          <p className="text-sm text-muted mt-0.5">Staff who can sign in, and what they can do.</p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 bg-brand hover:bg-brand-dark text-white rounded-control text-sm font-semibold shadow-xs"
        >
          <Plus className="w-4 h-4" /> Add staff
        </button>
      </div>

      {message && (
        <div
          className={`p-3 rounded-control border text-sm flex items-start gap-2 ${
            message.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-danger'
          }`}
        >
          {message.type === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="bg-white border border-line-strong rounded-card divide-y divide-line overflow-hidden">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4 animate-pulse flex gap-3">
              <div className="w-10 h-10 rounded-full bg-surface-2 border border-line" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-surface-2 rounded" />
                <div className="h-3 w-56 bg-surface-2 rounded" />
              </div>
            </div>
          ))
        ) : users.length === 0 ? (
          <div className="p-6 text-sm text-muted text-center">No users yet.</div>
        ) : (
          users.map((u) => {
            const isMe = u.uid === user?.uid;
            const busy = busyUid === u.uid;
            return (
              <div key={u.uid} className={`p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${!u.active ? 'bg-surface-2/60' : ''}`}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-brand-soft text-brand font-bold flex items-center justify-center">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-ink flex flex-wrap items-center gap-1.5">
                      {u.name}
                      {isMe && <span className="text-[10px] font-semibold text-muted">(you)</span>}
                      {!u.active && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-control bg-surface-2 border border-line text-muted">
                          Disabled
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted truncate">{u.email || '—'}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={u.role}
                    disabled={isMe || busy}
                    onChange={(e) =>
                      run(u.uid, () => updateStaffUser(u.uid, { role: e.target.value as UserRole }), `${u.name} is now ${e.target.value}.`)
                    }
                    className="h-10 px-2.5 rounded-control border border-line-strong bg-white text-sm font-medium text-ink disabled:bg-surface-2 disabled:text-muted"
                    aria-label={`Role for ${u.name}`}
                  >
                    <option value="sales">Sales</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    type="button"
                    disabled={!u.email || busy}
                    onClick={() => run(u.uid, () => sendPasswordReset(u.email!), `Password reset email sent to ${u.email}.`)}
                    className="h-10 inline-flex items-center gap-1.5 px-3 rounded-control border border-line-strong text-sm font-medium text-ink hover:bg-surface-2 disabled:opacity-50"
                  >
                    <KeyRound className="w-4 h-4" /> Reset password
                  </button>
                  <button
                    type="button"
                    disabled={isMe || busy}
                    onClick={() =>
                      run(u.uid, () => updateStaffUser(u.uid, { active: !u.active }), `${u.name} ${u.active ? 'disabled' : 'enabled'}.`)
                    }
                    className={`h-10 inline-flex items-center gap-1.5 px-3 rounded-control border text-sm font-medium disabled:opacity-50 ${
                      u.active ? 'border-rose-200 text-danger hover:bg-rose-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    <Power className="w-4 h-4" /> {u.active ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="text-xs text-muted flex items-start gap-1.5">
        <ShieldCheck className="w-4 h-4 shrink-0 text-faint" />
        Admins manage products, settings and users. Sales staff create quotations and customers. You can’t disable or
        change your own account, so you never lock yourself out.
      </p>

      {adding && (
        <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleCreate}
            className="bg-white w-full sm:max-w-md rounded-t-card sm:rounded-card shadow-xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">Add staff</h2>
              <button type="button" onClick={() => setAdding(false)} aria-label="Close" className="w-9 h-9 flex items-center justify-center rounded-control text-muted hover:bg-surface-2">
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block text-xs font-semibold text-muted">
              Name
              <input className={`${inputCls} mt-1`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="off" />
            </label>
            <label className="block text-xs font-semibold text-muted">
              Email
              <input className={`${inputCls} mt-1`} type="email" inputMode="email" autoCapitalize="none" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" />
            </label>
            <label className="block text-xs font-semibold text-muted">
              Temporary password
              <input className={`${inputCls} mt-1 font-mono`} type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
              <span className="block font-normal text-faint mt-1">Share it with them privately; they can change it with “Forgot password”.</span>
            </label>
            <label className="block text-xs font-semibold text-muted">
              Role
              <select className={`${inputCls} mt-1`} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
                <option value="sales">Sales — quotations & customers</option>
                <option value="admin">Admin — everything</option>
              </select>
            </label>
            {formError && <p className="text-sm text-danger">{formError}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[48px] bg-brand hover:bg-brand-dark text-white rounded-control font-semibold disabled:opacity-60"
            >
              {saving ? 'Creating…' : 'Create account'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
