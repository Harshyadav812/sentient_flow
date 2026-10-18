import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Activity, Calendar, Key, Workflow } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { deleteAccount, getAllExecutions, getCredentials, getWorkflows, updateMe } from '@/lib/api';
import { formatDate, initials } from '@/lib/format';
import { SettingsSection } from '@/components/settings/Section';
import { Btn, Field, TextInput } from '@/components/common/controls';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { SettingsPageTitle } from './SettingsLayout';

export function AccountSettings() {
  return (
    <>
      <SettingsPageTitle title="Account" description="Manage your profile and account details" />
      <ProfileSection />
      <OverviewSection />
      <DangerZone />
    </>
  );
}

function ProfileSection() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name ?? '');
      setEmail(user.email);
    }
  }, [user]);

  if (!user) return <SectionSkeleton />;

  const emailChanged = email.trim() !== user.email;
  const dirty = fullName.trim() !== (user.full_name ?? '') || emailChanged;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const reset = () => {
    setFullName(user.full_name ?? '');
    setEmail(user.email);
    setCurrentPassword('');
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateMe({
        full_name: fullName.trim(),
        ...(emailChanged ? { email: email.trim(), current_password: currentPassword } : {}),
      });
      setUser(updated);
      setCurrentPassword('');
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSection
      title="Profile"
      description="Your name is shown in the sidebar. Your email is used to sign in."
      footer={
        <>
          {dirty && (
            <Btn variant="ghost" onClick={reset} disabled={saving}>
              Discard
            </Btn>
          )}
          <Btn
            onClick={save}
            loading={saving}
            disabled={!dirty || !emailValid || (emailChanged && !currentPassword)}
          >
            Save changes
          </Btn>
        </>
      }
    >
      <form
        className="flex flex-col gap-5 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty && emailValid && (!emailChanged || currentPassword)) save();
        }}
      >
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-node-trigger to-[#c2410c] text-[20px] font-semibold text-white shadow-inner">
          {initials(fullName || user.full_name, user.email)}
        </div>
        <div className="grid flex-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="full-name">
            <TextInput
              id="full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ada Lovelace"
              maxLength={255}
              autoComplete="name"
            />
          </Field>
          <Field
            label="Email"
            htmlFor="email"
            error={email && !emailValid ? 'Enter a valid email address' : undefined}
          >
            <TextInput
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              invalid={!!email && !emailValid}
              autoComplete="email"
            />
          </Field>
          {emailChanged && (
            <div className="sm:col-span-2">
              <Field
                label="Current password"
                htmlFor="email-password"
                hint="Required to change the email you sign in with."
              >
                <TextInput
                  id="email-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </Field>
            </div>
          )}
          {/* Lets Enter submit the form */}
          <button type="submit" hidden />
        </div>
      </form>
    </SettingsSection>
  );
}

function OverviewSection() {
  const user = useAuthStore((s) => s.user);
  const [counts, setCounts] = useState<{ workflows: number; executions: number; credentials: number } | null>(null);

  useEffect(() => {
    Promise.all([getWorkflows(), getAllExecutions(), getCredentials()])
      .then(([w, e, c]) => setCounts({ workflows: w.length, executions: e.length, credentials: c.length }))
      .catch(() => setCounts(null));
  }, []);

  const stats = [
    { icon: Calendar, label: 'Member since', value: formatDate(user?.created_at) },
    { icon: Workflow, label: 'Workflows', value: counts?.workflows },
    { icon: Activity, label: 'Executions', value: counts?.executions },
    { icon: Key, label: 'Credentials', value: counts?.credentials },
  ];

  return (
    <SettingsSection title="Overview" description="A summary of what's in your account.">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-lg border border-[#2e2e33] bg-background px-3.5 py-3">
            <dt className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <Icon size={12} />
              {label}
            </dt>
            <dd className="mt-1 text-[15px] font-semibold text-zinc-100 tabular-nums">
              {value ?? <span className="inline-block h-4 w-8 animate-pulse rounded bg-white/5 align-middle" />}
            </dd>
          </div>
        ))}
      </dl>
    </SettingsSection>
  );
}

function DangerZone() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');

  const handleDelete = async () => {
    try {
      await deleteAccount(password);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete account');
      throw err;
    }
    toast.success('Your account has been deleted');
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <SettingsSection
      tone="danger"
      title="Danger zone"
      description="Permanently delete your account along with all workflows, executions and credentials. This cannot be undone."
    >
      <Btn
        variant="danger"
        onClick={() => {
          setPassword('');
          setOpen(true);
        }}
      >
        Delete account
      </Btn>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete your account?"
        description="All of your workflows, execution history and stored credentials will be permanently removed."
        confirmLabel="Delete account"
        confirmDisabled={!password}
        onConfirm={handleDelete}
      >
        <Field label="Enter your password to confirm" htmlFor="delete-password">
          <TextInput
            id="delete-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
          />
        </Field>
      </ConfirmDialog>
    </SettingsSection>
  );
}

function SectionSkeleton() {
  return <div className="h-48 animate-pulse rounded-xl border border-[#2e2e33] bg-surface" />;
}
