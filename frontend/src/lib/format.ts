/** Backend timestamps are UTC but may arrive without a zone suffix. */
export function parseUTC(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  return new Date(dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z');
}

export function formatDateTime(dateStr: string | null | undefined): string {
  const d = parseUTC(dateStr);
  if (!d) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDate(dateStr: string | null | undefined): string {
  const d = parseUTC(dateStr);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatRelative(dateStr: string | null | undefined): string {
  const d = parseUTC(dateStr);
  if (!d) return '—';
  const mins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
}

export function formatDuration(start: string | null, end: string | null): string {
  const s = parseUTC(start);
  const e = parseUTC(end);
  if (!s || !e) return '—';
  const ms = e.getTime() - s.getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export function initials(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name || '').trim();
  if (source) {
    const parts = source.split(/\s+/);
    return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  return (email || '?')[0].toUpperCase();
}
