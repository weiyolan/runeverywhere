/** Safety & live location (P5 G3): auto-share toggle, contacts, SOS info. */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { updateProfile } from '@/lib/profile';
import { qk } from '@/lib/queryKeys';
import { deleteContact, listContacts, saveContact, type SafetyContact } from '@/lib/safety';
import { useSession } from '@/stores/session';
import {
  borderWidth,
  colors,
  fonts,
  radius,
  sizing,
  spacing,
  textStyles,
  typeScale,
} from '@/theme/theme';

const PHONE_RE = /^[+0-9 ()-]{5,24}$/;

interface Draft {
  id?: string;
  name: string;
  phone: string;
  label: string;
  is_emergency: boolean;
}

export default function SafetyScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const profile = useSession((s) => s.profile);
  const refreshProfile = useSession((s) => s.refreshProfile);

  const [autoShare, setAutoShare] = useState(profile?.live_share_auto ?? false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const contacts = useQuery({ queryKey: qk.safetyContacts(), queryFn: listContacts });
  const emergency = (contacts.data ?? []).find((c) => c.is_emergency) ?? null;
  const trusted = (contacts.data ?? []).filter((c) => !c.is_emergency);

  const toggleAutoShare = (value: boolean) => {
    const prev = autoShare;
    setAutoShare(value);
    void updateProfile({ live_share_auto: value })
      .then(() => refreshProfile())
      .catch(() => setAutoShare(prev));
  };

  const openForm = (contact: SafetyContact | null, isEmergency: boolean) =>
    setDraft(
      contact
        ? { id: contact.id, name: contact.name, phone: contact.phone, label: contact.label, is_emergency: contact.is_emergency }
        : { name: '', phone: '', label: '', is_emergency: isEmergency },
    );

  const submit = async () => {
    if (!draft) return;
    if (!PHONE_RE.test(draft.phone.trim())) {
      setFormError('Enter a valid phone number.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await saveContact({ ...draft, name: draft.name.trim(), phone: draft.phone.trim(), label: draft.label.trim() });
      void queryClient.invalidateQueries({ queryKey: qk.safetyContacts() });
      setDraft(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      setFormError(
        message.includes('trusted contact limit')
          ? 'Trusted contact limit reached (5).'
          : message.includes('duplicate') || message.includes('unique')
            ? 'You already have an emergency contact.'
            : 'Could not save the contact.',
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await deleteContact(id);
    void queryClient.invalidateQueries({ queryKey: qk.safetyContacts() });
    setDraft(null);
  };

  const contactRow = (c: SafetyContact) => (
    <View key={c.id} style={styles.contactRow}>
      <View style={styles.contactText}>
        <Text style={styles.contactName}>{c.name}</Text>
        <Text style={textStyles.caption}>
          {[c.label, c.phone].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Button label="EDIT" size="sm" variant="ghost" onPress={() => openForm(c, c.is_emergency)} />
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp3 }]}>
      <View style={styles.header}>
        <IconButton variant="ghost" accessibilityLabel="Back" onPress={() => router.back()}>
          <ArrowLeft size={22} />
        </IconButton>
        <Text style={textStyles.sectionHeader}>Safety</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.sp10 }]}>
        <View style={styles.introCard}>
          <Text style={styles.introText}>
            Run safe with strangers — share your live location with people you trust and keep an
            emergency contact one hold away.
          </Text>
        </View>

        <View style={styles.shareRow}>
          <View style={styles.shareText}>
            <Text style={styles.shareLabel}>Share live location</Text>
            <Text style={[textStyles.caption, autoShare && styles.shareOn]}>
              {autoShare
                ? 'Active automatically when you start a run'
                : 'Off — enable per run from the live screen'}
            </Text>
          </View>
          <Switch
            value={autoShare}
            onValueChange={toggleAutoShare}
            trackColor={{ true: colors.volt, false: colors.ink200 }}
            thumbColor={colors.paper}
          />
        </View>

        <View style={styles.section}>
          <Text style={textStyles.eyebrow}>EMERGENCY CONTACT</Text>
          {emergency ? (
            contactRow(emergency)
          ) : (
            <Button
              label="ADD EMERGENCY CONTACT"
              variant="secondary"
              full
              onPress={() => openForm(null, true)}
            />
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.trustedHeader}>
            <Text style={textStyles.eyebrow}>TRUSTED CONTACTS</Text>
            <Text style={textStyles.caption}>{trusted.length} of 5</Text>
          </View>
          {trusted.map(contactRow)}
          {trusted.length < 5 ? (
            <Button
              label="ADD TRUSTED CONTACT"
              variant="ghost"
              full
              onPress={() => openForm(null, false)}
            />
          ) : null}
        </View>

        <View style={styles.sosCard}>
          <Text style={styles.sosTitle}>EMERGENCY SOS</Text>
          <Text style={styles.sosBody}>
            During a run, hold SOS to prefill a text to your contacts with your live location. Run
            Everywhere never contacts emergency services for you.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={draft != null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {draft?.id ? 'EDIT CONTACT' : draft?.is_emergency ? 'EMERGENCY CONTACT' : 'TRUSTED CONTACT'}
            </Text>
            <Input label="NAME" value={draft?.name ?? ''} onChangeText={(t) => setDraft((d) => d && { ...d, name: t })} maxLength={60} />
            <Input
              label="PHONE"
              value={draft?.phone ?? ''}
              onChangeText={(t) => setDraft((d) => d && { ...d, phone: t })}
              keyboardType="phone-pad"
              maxLength={24}
            />
            <Input
              label="LABEL"
              value={draft?.label ?? ''}
              onChangeText={(t) => setDraft((d) => d && { ...d, label: t })}
              placeholder="Partner, Sister…"
              maxLength={30}
            />
            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            <Button
              label={saving ? 'SAVING…' : 'SAVE'}
              full
              disabled={saving || !draft || draft.name.trim().length === 0}
              onPress={() => void submit()}
            />
            {draft?.id ? (
              <Button label="DELETE" variant="danger" full onPress={() => void remove(draft.id!)} />
            ) : null}
            <Button label="CANCEL" variant="ghost" full onPress={() => setDraft(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp2,
    paddingHorizontal: spacing.sp3,
    paddingBottom: spacing.sp2,
  },
  content: {
    paddingHorizontal: sizing.gutter,
    paddingTop: spacing.sp3,
    gap: spacing.sp5,
  },
  introCard: {
    backgroundColor: colors.ink900,
    borderRadius: radius.md,
    padding: spacing.sp4,
  },
  introText: {
    fontFamily: fonts.body,
    fontSize: typeScale.tSm,
    lineHeight: typeScale.tSm * 1.45,
    color: colors.ink300,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink100,
    padding: spacing.sp4,
  },
  shareText: { flex: 1, gap: 2 },
  shareLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: typeScale.tMd,
    color: colors.ink900,
  },
  shareOn: { color: colors.go },
  section: { gap: spacing.sp3 },
  trustedHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: borderWidth.hair,
    borderColor: colors.ink100,
    padding: spacing.sp4,
  },
  contactText: { flex: 1, gap: 1 },
  contactName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: typeScale.tMd,
    color: colors.ink900,
  },
  sosCard: {
    borderWidth: borderWidth.mid,
    borderColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.sp4,
    gap: spacing.sp2,
  },
  sosTitle: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tMd,
    color: colors.danger,
  },
  sosBody: {
    fontFamily: fonts.body,
    fontSize: typeScale.tSm,
    lineHeight: typeScale.tSm * 1.45,
    color: colors.ink500,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,11,12,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: sizing.gutter,
    paddingBottom: spacing.sp10,
    gap: spacing.sp3,
  },
  modalTitle: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.d3,
    color: colors.ink900,
  },
  error: { ...textStyles.caption, color: colors.danger },
});
