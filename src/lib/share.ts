import { Share } from 'react-native';

import type { RunRow } from '@/lib/runs';

/** The one invite share message (H2/I1/I2 all share the same link copy). */
export function shareRunInvite(run: Pick<RunRow, 'title' | 'invite_code'>) {
  return Share.share({
    message: `Join my run “${run.title}” on Run Everywhere → runeverywhere://invite/${run.invite_code}`,
  });
}
