/**
 * Input — port of `project/components/forms/Input.d.ts` (P1 D1).
 * Bold structural field with an uppercase micro-label; single-line or
 * multiline, leading/trailing adornments, hint/error text below.
 */
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
  type TextInputProps,
} from 'react-native';

import {
  borderWidth,
  colors,
  fonts,
  letterSpacing,
  radius,
  semantic,
  sizing,
  spacing,
  tracking,
  typeScale,
} from '@/theme/theme';

export interface InputProps {
  /** Uppercase micro-label above the field. */
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  autoFocus?: boolean;
  maxLength?: number;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  /** Render a textarea instead of a single line. */
  multiline?: boolean;
  numberOfLines?: number;
  /** Leading adornment (icon or unit). */
  leading?: React.ReactNode;
  /** Trailing adornment (icon, unit, clear). */
  trailing?: React.ReactNode;
  /** Helper / error text below. */
  hint?: string;
  invalid?: boolean;
  disabled?: boolean;
  testID?: string;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoComplete,
  autoFocus,
  maxLength,
  returnKeyType,
  onSubmitEditing,
  multiline = false,
  numberOfLines = 3,
  leading,
  trailing,
  hint,
  invalid = false,
  disabled = false,
  testID,
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const border = invalid ? colors.danger : focused ? colors.ink900 : colors.ink200;

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          multiline ? styles.fieldMultiline : styles.fieldSingle,
          { borderColor: border, backgroundColor: disabled ? semantic.bgSunken : semantic.bgSurface },
        ]}
      >
        {leading ? <View style={styles.adornment}>{leading}</View> : null}
        <TextInput
          testID={testID}
          style={[styles.text, multiline && styles.textMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={semantic.textMuted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          maxLength={maxLength}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : 1}
          editable={!disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {trailing ? <View style={styles.adornment}>{trailing}</View> : null}
      </View>
      {hint ? (
        <Text style={[styles.hint, { color: invalid ? colors.danger : semantic.textMuted }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tXs,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing(typeScale.tXs, tracking.label),
    color: colors.ink500,
    marginBottom: spacing.sp2,
  },
  field: {
    flexDirection: 'row',
    borderWidth: borderWidth.mid,
    borderRadius: radius.sm,
    gap: 10,
  },
  fieldSingle: {
    alignItems: 'center',
    height: sizing.controlH,
    paddingHorizontal: 14,
  },
  fieldMultiline: {
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  text: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.tMd,
    color: semantic.textPrimary,
    padding: 0,
  },
  textMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  adornment: {
    justifyContent: 'center',
  },
  hint: {
    marginTop: 6,
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.tXs,
  },
});

export default Input;
