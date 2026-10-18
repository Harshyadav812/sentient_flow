import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { createCredential } from '@/lib/api';
import { CREDENTIAL_TYPES } from '@/lib/credentialTypes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Btn, Field, TextInput } from '@/components/common/controls';

type CredType = keyof typeof CREDENTIAL_TYPES;

export function CreateCredentialDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<CredType>('api_key');
  const [values, setValues] = useState<Record<string, string>>({});
  const [json, setJson] = useState('{\n  "token": ""\n}');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setType('api_key');
      setValues({});
      setJson('{\n  "token": ""\n}');
    }
  }, [open]);

  const def = CREDENTIAL_TYPES[type];
  let jsonError: string | null = null;
  if (type === 'custom') {
    try {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) jsonError = 'Must be a JSON object';
    } catch {
      jsonError = 'Invalid JSON';
    }
  }
  const fieldsFilled = def.fields.every((f) => (values[f.key] ?? '').trim());
  const canSave = name.trim() && (type === 'custom' ? !jsonError : fieldsFilled);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const data =
        type === 'custom'
          ? JSON.parse(json)
          : Object.fromEntries(def.fields.map((f) => [f.key, values[f.key].trim()]));
      await createCredential({ name: name.trim(), type, data });
      toast.success('Credential saved');
      onCreated();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save credential');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="border-[#2e2e33] bg-surface text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold">New credential</DialogTitle>
          <DialogDescription className="text-[13px] text-zinc-400">
            Secrets are encrypted before they're stored and are never shown again.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Field label="Name" htmlFor="cred-name">
            <TextInput
              id="cred-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. OpenAI production key"
              autoFocus
            />
          </Field>

          <Field label="Type">
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(CREDENTIAL_TYPES) as CredType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={clsx(
                    'h-8 rounded-lg border text-[12px] transition-colors',
                    type === t
                      ? 'border-node-trigger/50 bg-node-trigger/10 font-medium text-zinc-100'
                      : 'border-[#2e2e33] text-zinc-400 hover:border-[#3a3a40] hover:text-zinc-200'
                  )}
                >
                  {CREDENTIAL_TYPES[t].label}
                </button>
              ))}
            </div>
          </Field>

          {type === 'custom' ? (
            <Field label="Data" htmlFor="cred-json" error={jsonError ?? undefined} hint="A JSON object of key/value pairs.">
              <textarea
                id="cred-json"
                value={json}
                onChange={(e) => setJson(e.target.value)}
                rows={5}
                spellCheck={false}
                className="w-full resize-y rounded-lg border border-[#2e2e33] bg-background px-3 py-2 font-mono text-[12px] text-zinc-200 outline-none focus:border-node-trigger/50"
              />
            </Field>
          ) : (
            def.fields.map((f) => (
              <Field key={f.key} label={f.label} htmlFor={`cred-${f.key}`}>
                <TextInput
                  id={`cred-${f.key}`}
                  type={f.secret ? 'password' : 'text'}
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  autoComplete="off"
                  className={f.secret ? 'font-mono' : undefined}
                />
              </Field>
            ))
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Btn type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Btn>
            <Btn type="submit" loading={saving} disabled={!canSave}>
              Save credential
            </Btn>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
