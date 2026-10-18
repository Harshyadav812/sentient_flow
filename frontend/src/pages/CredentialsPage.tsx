import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Key, Lock, Plus, Trash2 } from 'lucide-react';
import { deleteCredential, getCredentials, type CredentialData } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { usePreferences } from '@/stores/preferencesStore';
import { CreateCredentialDialog } from '@/components/CreateCredentialDialog';
import { CREDENTIAL_TYPES } from '@/lib/credentialTypes';
import { EmptyState, ListSkeleton, PageContainer, PageHeader, SearchBox } from '@/components/common/PageHeader';
import { Badge, Btn } from '@/components/common/controls';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

export function CredentialsPage() {
  const [credentials, setCredentials] = useState<CredentialData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState<CredentialData | null>(null);
  const confirmBeforeDelete = usePreferences((s) => s.confirmBeforeDelete);

  const load = async () => {
    try {
      setCredentials(await getCredentials());
    } catch {
      toast.error('Failed to load credentials');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (cred: CredentialData) => {
    try {
      await deleteCredential(cred.id);
      setCredentials((cs) => cs.filter((c) => c.id !== cred.id));
      toast.success(`Deleted "${cred.name}"`);
    } catch (err) {
      toast.error('Failed to delete credential');
      throw err;
    }
  };

  const filtered = credentials.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <PageContainer>
      <PageHeader
        title="Credentials"
        description="API keys and tokens your workflow nodes can use. Values are encrypted at rest."
        actions={
          <Btn onClick={() => setShowCreate(true)}>
            <Plus /> New credential
          </Btn>
        }
      />

      {isLoading ? (
        <ListSkeleton />
      ) : credentials.length === 0 ? (
        <EmptyState
          icon={<Key size={22} />}
          title="No credentials yet"
          description="Store API keys and tokens securely, then pick them from any node that needs one."
          action={
            <Btn onClick={() => setShowCreate(true)}>
              <Plus /> Add credential
            </Btn>
          }
        />
      ) : (
        <>
          <SearchBox value={query} onChange={setQuery} placeholder="Search credentials…" />
          <div className="overflow-hidden rounded-xl border border-[#2e2e33] bg-surface">
            <div className="hidden grid-cols-[1fr_140px_120px_40px] gap-4 border-b border-[#2e2e33] px-4 py-2.5 text-[11px] font-medium tracking-wide text-zinc-500 uppercase sm:grid">
              <span>Name</span>
              <span>Type</span>
              <span>Created</span>
              <span />
            </div>
            <ul className="divide-y divide-[#2e2e33]">
              {filtered.map((c) => (
                <li
                  key={c.id}
                  className="group grid grid-cols-[1fr_40px] items-center gap-4 px-4 py-3 transition-colors hover:bg-white/2 sm:grid-cols-[1fr_140px_120px_40px]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-hover text-zinc-400">
                      <Lock size={14} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-zinc-200">{c.name}</div>
                      <div className="font-mono text-[11px] text-zinc-600 sm:hidden">
                        {CREDENTIAL_TYPES[c.type as keyof typeof CREDENTIAL_TYPES]?.label ?? c.type}
                      </div>
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <Badge>{CREDENTIAL_TYPES[c.type as keyof typeof CREDENTIAL_TYPES]?.label ?? c.type}</Badge>
                  </div>
                  <div className="hidden text-[12px] text-zinc-500 sm:block">{formatDate(c.created_at)}</div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => (confirmBeforeDelete ? setPendingDelete(c) : remove(c).catch(() => {}))}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 opacity-60 transition-all group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 focus-visible:opacity-100"
                      aria-label={`Delete ${c.name}`}
                      title="Delete credential"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="py-10 text-center text-[13px] text-zinc-500">No credentials match "{query}"</li>
              )}
            </ul>
          </div>
        </>
      )}

      <CreateCredentialDialog open={showCreate} onOpenChange={setShowCreate} onCreated={load} />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Delete "${pendingDelete?.name}"?`}
        description="Workflows that use this credential will fail until you select another one."
        onConfirm={() => remove(pendingDelete!)}
      />
    </PageContainer>
  );
}
