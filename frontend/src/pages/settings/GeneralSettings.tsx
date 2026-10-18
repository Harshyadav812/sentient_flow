import { useState } from 'react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { RotateCcw } from 'lucide-react';
import { usePreferences, type Preferences } from '@/stores/preferencesStore';
import { SettingRow, SettingRows, SettingsSection } from '@/components/settings/Section';
import { Btn, Switch } from '@/components/common/controls';
import { formatDateTime } from '@/lib/format';
import { SettingsPageTitle } from './SettingsLayout';

type BoolKey = {
  [K in keyof Preferences]: Preferences[K] extends boolean ? K : never;
}[keyof Preferences];

function Toggle({ k, title, description }: { k: BoolKey; title: string; description: string }) {
  const value = usePreferences((s) => s[k]);
  const set = usePreferences((s) => s.set);
  return (
    <SettingRow
      title={title}
      description={description}
      control={<Switch label={title} checked={value} onChange={(v) => set(k, v)} />}
    />
  );
}

export function GeneralSettings() {
  const timestampFormat = usePreferences((s) => s.timestampFormat);
  const set = usePreferences((s) => s.set);
  const reset = usePreferences((s) => s.reset);

  const [sampleDate] = useState(() => new Date(Date.now() - 3 * 3600_000).toISOString());

  return (
    <>
      <SettingsPageTitle title="General" description="Application preferences and defaults" />

      <SettingsSection title="Workflow editor" description="Defaults applied when you open the canvas.">
        <SettingRows>
          <Toggle k="showMinimap" title="Show minimap" description="Display an overview map in the bottom-right corner of the canvas." />
          <Toggle k="showGrid" title="Show grid" description="Draw a dot grid behind your nodes." />
          <Toggle k="snapToGrid" title="Snap to grid" description="Align nodes to the grid while dragging them." />
          <Toggle
            k="openPaletteByDefault"
            title="Open node panel on load"
            description="Show the node list on the left whenever a workflow opens."
          />
        </SettingRows>
      </SettingsSection>

      <SettingsSection title="Workflows" description="Safety and housekeeping.">
        <SettingRows>
          <Toggle
            k="confirmBeforeDelete"
            title="Confirm before deleting"
            description="Ask for confirmation before a workflow or credential is deleted."
          />
        </SettingRows>
      </SettingsSection>

      <SettingsSection title="Display" description="How dates and times appear across the app.">
        <SettingRows>
          <SettingRow
            title="Timestamps"
            description={
              <>
                Example: <span className="text-zinc-300">{timestampFormat === 'relative' ? '3h ago' : formatDateTime(sampleDate)}</span>
              </>
            }
            control={
              <div role="radiogroup" aria-label="Timestamp format" className="flex rounded-lg border border-[#2e2e33] bg-background p-0.5">
                {(['relative', 'absolute'] as const).map((opt) => (
                  <button
                    key={opt}
                    role="radio"
                    aria-checked={timestampFormat === opt}
                    onClick={() => set('timestampFormat', opt)}
                    className={clsx(
                      'h-7 rounded-md px-3 text-[12px] capitalize transition-colors',
                      timestampFormat === opt ? 'bg-surface-hover font-medium text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            }
          />
        </SettingRows>
      </SettingsSection>

      <div className="flex items-center justify-between gap-4">
        <p className="text-[11px] text-zinc-600">Preferences are saved in this browser.</p>
        <Btn
          variant="ghost"
          onClick={() => {
            reset();
            toast.success('Preferences reset to defaults');
          }}
        >
          <RotateCcw /> Reset to defaults
        </Btn>
      </div>
    </>
  );
}
