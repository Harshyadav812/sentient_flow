import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Check, Copy, LogOut, Monitor, ShieldCheck, ShieldOff } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '@/stores/authStore';
import { changePassword, disableTwoFactor, enableTwoFactor, setupTwoFactor } from '@/lib/api';
import { PASSWORD_RULES, passwordSchema } from '@/lib/validation';
import { SettingsSection } from '@/components/settings/Section';
import { Badge, Btn, CodeInput, Field, TextInput } from '@/components/common/controls';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { SettingsPageTitle } from './SettingsLayout';

export function SecuritySettings() {
  return (
    <>
      <SettingsPageTitle title="Security" description="Password, two-factor authentication and sessions" />
      <PasswordSection />
      <TwoFactorSection />
      <SessionSection />
    </>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const nextValid = passwordSchema.safeParse(next).success;
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSubmit = current && nextValid && confirm === next;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      toast.success('Password updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSection
      title="Password"
      description="Use a strong password you don't use anywhere else."
      footer={
        <Btn onClick={submit} loading={saving} disabled={!canSubmit}>
          Update password
        </Btn>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]">
          <Field label="Current password" htmlFor="current-password">
            <TextInput
              id="current-password"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
        </div>
        <Field label="New password" htmlFor="new-password">
          <TextInput
            id="new-password"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm-password" error={mismatch ? "Passwords don't match" : undefined}>
          <TextInput
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            invalid={mismatch}
            autoComplete="new-password"
          />
        </Field>

        {next.length > 0 && (
          <ul className="grid gap-x-4 gap-y-1 text-[11px] sm:col-span-2 sm:grid-cols-3">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(next);
              return (
                <li key={rule.label} className={clsx('flex items-center gap-1.5', ok ? 'text-emerald-400' : 'text-zinc-500')}>
                  <Check size={11} className={ok ? 'opacity-100' : 'opacity-30'} />
                  {rule.label}
                </li>
              );
            })}
          </ul>
        )}
        <button type="submit" hidden />
      </form>
    </SettingsSection>
  );
}

function TwoFactorSection() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');

  const enabled = !!user?.totp_enabled;

  const start = async () => {
    setStarting(true);
    try {
      setSetup(await setupTwoFactor());
      setCode('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start setup');
    } finally {
      setStarting(false);
    }
  };

  const verify = async () => {
    setVerifying(true);
    try {
      setUser(await enableTwoFactor(code));
      setSetup(null);
      toast.success('Two-factor authentication enabled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setVerifying(false);
    }
  };

  const disable = async () => {
    try {
      setUser(await disableTwoFactor(disablePassword, disableCode));
      toast.success('Two-factor authentication disabled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not disable 2FA');
      throw err;
    }
  };

  const copySecret = async () => {
    if (!setup) return;
    await navigator.clipboard.writeText(setup.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <SettingsSection
      title="Two-factor authentication"
      description="Require a code from an authenticator app (1Password, Google Authenticator, Authy…) when signing in."
    >
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#2e2e33] bg-background px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              'flex h-9 w-9 items-center justify-center rounded-lg',
              enabled ? 'bg-emerald-400/10 text-emerald-400' : 'bg-surface-hover text-zinc-500'
            )}
          >
            {enabled ? <ShieldCheck size={17} /> : <ShieldOff size={17} />}
          </div>
          <div>
            <div className="flex items-center gap-2 text-[13px] font-medium text-zinc-200">
              Authenticator app
              {enabled ? <Badge tone="success">Enabled</Badge> : <Badge>Off</Badge>}
            </div>
            <p className="text-[12px] text-zinc-500">
              {enabled ? 'A code is required each time you sign in.' : 'Only your password is required to sign in.'}
            </p>
          </div>
        </div>
        {enabled ? (
          <Btn
            variant="secondary"
            onClick={() => {
              setDisablePassword('');
              setDisableCode('');
              setDisableOpen(true);
            }}
          >
            Disable
          </Btn>
        ) : (
          !setup && (
            <Btn onClick={start} loading={starting}>
              Set up
            </Btn>
          )
        )}
      </div>

      {setup && !enabled && (
        <div className="mt-4 grid gap-5 rounded-lg border border-[#2e2e33] p-4 sm:grid-cols-[auto_1fr]">
          <div className="mx-auto rounded-lg bg-white p-2.5 sm:mx-0">
            <QRCodeSVG value={setup.otpauth_uri} size={148} />
          </div>
          <div className="min-w-0 space-y-4">
            <ol className="list-decimal space-y-1 pl-4 text-[12px] text-zinc-400">
              <li>Scan the QR code with your authenticator app.</li>
              <li>Enter the 6-digit code it shows to finish setup.</li>
            </ol>
            <div>
              <div className="mb-1 text-[11px] text-zinc-500">Can't scan? Enter this key manually:</div>
              <div className="flex items-center gap-1.5">
                <code className="min-w-0 flex-1 truncate rounded-md border border-[#2e2e33] bg-background px-2.5 py-1.5 font-mono text-[12px] tracking-wider text-zinc-300">
                  {setup.secret.match(/.{1,4}/g)?.join(' ')}
                </code>
                <Btn variant="secondary" onClick={copySecret} aria-label="Copy setup key" className="w-8 px-0">
                  {copied ? <Check /> : <Copy />}
                </Btn>
              </div>
            </div>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.length === 6) verify();
              }}
            >
              <div className="w-36">
                <Field label="Verification code" htmlFor="totp-code">
                  <CodeInput id="totp-code" value={code} onChange={setCode} autoFocus />
                </Field>
              </div>
              <Btn type="submit" loading={verifying} disabled={code.length !== 6} className="h-9">
                Verify & enable
              </Btn>
              <Btn type="button" variant="ghost" onClick={() => setSetup(null)} className="h-9">
                Cancel
              </Btn>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        title="Disable two-factor authentication?"
        description="Your account will be protected by your password only."
        confirmLabel="Disable 2FA"
        confirmDisabled={!disablePassword || disableCode.length !== 6}
        onConfirm={disable}
      >
        <div className="space-y-3">
          <Field label="Password" htmlFor="disable-password">
            <TextInput
              id="disable-password"
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </Field>
          <Field label="Authenticator code" htmlFor="disable-code">
            <CodeInput id="disable-code" value={disableCode} onChange={setDisableCode} />
          </Field>
        </div>
      </ConfirmDialog>
    </SettingsSection>
  );
}

function SessionSection() {
  const logout = useAuthStore((s) => s.logout);

  return (
    <SettingsSection title="Session" description="Sessions expire automatically. Signing out removes the session from this browser.">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-hover text-zinc-400">
            <Monitor size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[13px] font-medium text-zinc-200">
              This browser <Badge tone="success">Active</Badge>
            </div>
            <p className="text-[12px] text-zinc-500">{describeBrowser()}</p>
          </div>
        </div>
        <Btn variant="secondary" onClick={logout}>
          <LogOut /> Sign out
        </Btn>
      </div>
    </SettingsSection>
  );
}

function describeBrowser() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS X/.test(ua)
      ? 'macOS'
      : /Android/.test(ua)
        ? 'Android'
        : /iPhone|iPad/.test(ua)
          ? 'iOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Unknown OS';
  return `${browser} on ${os}`;
}
