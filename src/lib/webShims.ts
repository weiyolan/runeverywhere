/**
 * react-native-web gaps, patched once for every caller:
 * - Alert.alert is a no-op, so confirm dialogs (cancel spot, cancel run, block,
 *   discard draft…) silently did nothing. Route to the browser's own dialogs.
 * - Linking.openSettings doesn't exist (throws). Browsers have no app settings
 *   page; point the user at site settings instead.
 * - router.back() is a no-op when the page was opened directly (refresh, shared
 *   link) because there is no history. Fall back to Explore.
 * ponytail: window.confirm is two-button only; a 3-button alert maps its last
 * non-cancel button to OK. Swap for an in-app modal if a real 3-way choice appears.
 */
import { router } from 'expo-router';
import { Alert, Linking, Platform, type AlertButton } from 'react-native';

export function installWebShims() {
  if (Platform.OS !== 'web') return;

  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = message ? `${title}\n\n${message}` : title;
    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }
    const cancel = buttons.find((b) => b.style === 'cancel') ?? buttons[0];
    const action = [...buttons].reverse().find((b) => b !== cancel);
    (window.confirm(text) ? action : cancel)?.onPress?.();
  };

  Linking.openSettings = async () => {
    window.alert(
      'Allow it in your browser: tap the icon next to the address bar → Site settings / Permissions, then reload.',
    );
  };

  const back = router.back;
  router.back = () => (router.canGoBack() ? back() : router.replace('/'));
}
