/** Legal (P5 F7) — external terms/privacy links + deletion pointer. */
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsRow, SettingsSection } from '@/components/settings/SettingsRow';
import { IconButton } from '@/components/ui/IconButton';
import { LEGAL_URLS } from '@/lib/legal';
import { colors, sizing, spacing, textStyles } from '@/theme/theme';

export default function LegalScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp3 }]}>
      <View style={styles.header}>
        <IconButton variant="ghost" accessibilityLabel="Back" onPress={() => router.back()}>
          <ArrowLeft size={22} />
        </IconButton>
        <Text style={textStyles.sectionHeader}>Legal</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <SettingsSection label="DOCUMENTS">
          <SettingsRow
            label="Terms of Service"
            onPress={() => void Linking.openURL(LEGAL_URLS.terms)}
          />
          <SettingsRow
            label="Privacy Policy"
            onPress={() => void Linking.openURL(LEGAL_URLS.privacy)}
          />
        </SettingsSection>
        <Text style={textStyles.caption}>
          Data &amp; account deletion lives in Account &amp; security.
        </Text>
      </ScrollView>
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
    gap: spacing.sp3,
  },
});
