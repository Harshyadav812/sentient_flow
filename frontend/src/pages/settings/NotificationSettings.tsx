import { useState } from 'react';
import { toast } from 'sonner';
import { usePreferences } from '@/stores/preferencesStore';
import { SettingRow, SettingRows, SettingsSection } from '@/components/settings/Section';
import { Badge, Btn, Switch } from '@/components/common/controls';
import { SettingsPageTitle } from './SettingsLayout';

const desktopSupported = typeof window !== 'undefined' && 'Notification' in window;

export function NotificationSettings() {
  const prefs = usePreferences();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    desktopSupported ? Notification.permission : 'unsupported'
  );

  const toggleDesktop = async (value: boolean) => {
    if (!value) {
      prefs.set('desktopNotifications', false);
      return;
    }
    if (!desktopSupported) return;
    const result = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      prefs.set('desktopNotifications', true);
    } else {
      toast.error('Notification permission was denied by the browser');
    }
  };

  const sendTest = () => {
    new Notification('Sentient Flow', {
      body: 'Desktop notifications are working.',
      icon: '/favicon.svg',
    });
  };

  return (
    <>
      <SettingsPageTitle title="Notifications" description="Choose how you're alerted about workflow runs" />

      <SettingsSection
        title="In-app alerts"
        description="Toasts shown in the corner of the screen while you're using the editor."
      >
        <SettingRows>
          <SettingRow
            title="Workflow succeeded"
            description="Show a confirmation when a run finishes without errors."
            control={
              <Switch
                label="Workflow succeeded"
                checked={prefs.notifyOnSuccess}
                onChange={(v) => prefs.set('notifyOnSuccess', v)}
              />
            }
          />
          <SettingRow
            title="Workflow failed"
            description="Show an alert when a run ends in failure."
            control={
              <Switch
                label="Workflow failed"
                checked={prefs.notifyOnFailure}
                onChange={(v) => prefs.set('notifyOnFailure', v)}
              />
            }
          />
          <SettingRow
            title="Node errors"
            description="Show the error message from each node that fails during a run."
            control={
              <Switch
                label="Node errors"
                checked={prefs.notifyOnNodeError}
                onChange={(v) => prefs.set('notifyOnNodeError', v)}
              />
            }
          />
        </SettingRows>
      </SettingsSection>

      <SettingsSection
        title="Desktop notifications"
        description="Get a system notification when a run finishes while Sentient Flow is in a background tab."
        footer={
          prefs.desktopNotifications && permission === 'granted' ? (
            <Btn variant="secondary" onClick={sendTest}>
              Send test notification
            </Btn>
          ) : undefined
        }
      >
        <SettingRows>
          <SettingRow
            title="Enable desktop notifications"
            description={
              permission === 'unsupported' ? (
                'Your browser does not support desktop notifications.'
              ) : permission === 'denied' ? (
                <>
                  <Badge tone="warning">Blocked</Badge>{' '}
                  Allow notifications for this site in your browser settings to turn this on.
                </>
              ) : (
                'Your browser will ask for permission the first time.'
              )
            }
            control={
              <Switch
                label="Enable desktop notifications"
                checked={prefs.desktopNotifications && permission === 'granted'}
                disabled={permission === 'unsupported' || permission === 'denied'}
                onChange={toggleDesktop}
              />
            }
          />
        </SettingRows>
      </SettingsSection>

      <p className="text-[11px] text-zinc-600">Notification preferences are saved in this browser.</p>
    </>
  );
}
