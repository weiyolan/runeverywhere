/**
 * Run Everywhere — design tokens.
 *
 * Mechanical port of `run-everywhere-app-design/project/tokens/*.css`
 * (colors, typography, spacing, elevation). That folder is the design
 * source of truth; when a value changes there, change it here.
 */
import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  // Ink / neutral ramp (warm-neutral, near-black base)
  ink900: '#0B0B0C',
  ink800: '#18181B',
  ink700: '#2A2A2E',
  ink500: '#6B6B73',
  ink400: '#8E8E96',
  ink300: '#B7B7BD',
  ink200: '#DEDEE2',
  ink100: '#ECECEE',
  paper: '#FFFFFF',
  paper2: '#F5F5F3',
  paper3: '#EBEBE7',

  // Volt — brand hero accent (text/icon on volt is always near-black)
  volt: '#CCFF00',
  voltBright: '#DBFF3D',
  voltPress: '#B2E000',
  voltInk: '#0B0B0C',

  // Run-type system (category coding only — never decoration)
  discover: '#1463FF',
  discoverSoft: '#E7F0FF',
  discoverInk: '#FFFFFF',
  challenge: '#FF3D2E',
  challengeSoft: '#FFE9E6',
  challengeInk: '#FFFFFF',
  social: '#7C5CFC',
  socialSoft: '#EFEAFF',
  socialInk: '#FFFFFF',

  // Functional signals
  go: '#00C271',
  goSoft: '#DAF7EC',
  warn: '#FFB020',
  warnSoft: '#FFF2D8',
  danger: '#E5342A',
  dangerSoft: '#FCE5E3',
  star: '#FFC32B',
} as const;

/** Semantic aliases — use these in components. */
export const semantic = {
  bgApp: colors.paper2,
  bgSurface: colors.paper,
  bgSunken: colors.paper3,
  bgInverse: colors.ink900,

  textPrimary: colors.ink900,
  textSecondary: colors.ink500,
  textMuted: colors.ink400,
  textOnDark: colors.paper,
  textOnVolt: colors.voltInk,

  borderHairline: colors.ink200,
  borderStrong: colors.ink900,

  action: colors.volt,
  actionPress: colors.voltPress,
  actionInk: colors.voltInk,

  focusRing: colors.discover,
} as const;

export type RunType = 'discover' | 'challenge' | 'social';

export const runType: Record<
  RunType,
  { main: string; soft: string; ink: string; label: string }
> = {
  discover: { main: colors.discover, soft: colors.discoverSoft, ink: colors.discoverInk, label: 'DISCOVER' },
  challenge: { main: colors.challenge, soft: colors.challengeSoft, ink: colors.challengeInk, label: 'CHALLENGE' },
  social: { main: colors.social, soft: colors.socialSoft, ink: colors.socialInk, label: 'SOCIAL' },
};

/**
 * Families map to the static font files registered in app.config.ts
 * (expo-font config plugin). Static faces per weight — variable fonts are
 * unreliable on Android, so pick the family by weight, not fontWeight.
 */
export const fonts = {
  // Saira — body / goals / captions
  body: 'Saira-Regular',
  bodyMedium: 'Saira-Medium',
  bodySemiBold: 'Saira-SemiBold',
  bodyBold: 'Saira-Bold',
  // Saira Condensed — display, titles, labels, buttons, big metrics
  displayMedium: 'SairaCondensed-Medium',
  displaySemiBold: 'SairaCondensed-SemiBold',
  display: 'SairaCondensed-Bold',
  displayExtra: 'SairaCondensed-ExtraBold',
  displayBlack: 'SairaCondensed-Black',
} as const;

export const typeScale = {
  // Display (condensed, uppercase headlines)
  dHero: 64,
  d1: 40,
  d2: 30,
  d3: 22,
  dEyebrow: 13,
  // Body
  tLg: 18,
  tMd: 16,
  tSm: 14,
  tXs: 12,
  t2xs: 11,
} as const;

export const lineHeight = {
  tight: 1.02,
  snug: 1.15,
  normal: 1.45,
} as const;

/** Letter-spacing in px per font-size unit (CSS em → RN px: em × fontSize). */
export const tracking = {
  tight: -0.01,
  flat: 0,
  label: 0.08,
  caps: 0.04,
} as const;

export const letterSpacing = (fontSize: number, track: number) => fontSize * track;

export const spacing = {
  sp1: 4,
  sp2: 8,
  sp3: 12,
  sp4: 16,
  sp5: 20,
  sp6: 24,
  sp8: 32,
  sp10: 40,
  sp12: 48,
  sp16: 64,
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 12, // cards, sheets
  lg: 18, // large surfaces
  pill: 999, // chips, buttons, avatars
} as const;

export const sizing = {
  controlH: 52, // primary buttons / inputs
  controlHSm: 40,
  controlHXs: 32, // chips
  tabbarH: 64,
  touchMin: 44,
  gutter: 20, // screen side padding
} as const;

export const borderWidth = {
  hair: 1,
  mid: 1.5,
  bold: 2, // structural/athletic outline
} as const;

/** Tight, contrasty shadows (iOS shadow* + Android elevation). */
export const shadows = {
  sm: {
    shadowColor: colors.ink900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: colors.ink900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },
  lg: {
    shadowColor: colors.ink900,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 12,
  },
  pin: {
    shadowColor: colors.ink900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  volt: {
    shadowColor: colors.voltPress,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 6,
  },
} satisfies Record<string, ViewStyle>;

export const motion = {
  durFast: 120,
  durBase: 200,
  durSlow: 340,
  pressScale: 0.96,
} as const;

/** Ready-made text styles for the recurring type roles. */
export const textStyles = {
  screenTitle: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.d1,
    lineHeight: typeScale.d1 * lineHeight.tight,
    color: semantic.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing(typeScale.d1, tracking.tight),
  },
  sectionHeader: {
    fontFamily: fonts.display,
    fontSize: typeScale.d2,
    lineHeight: typeScale.d2 * lineHeight.snug,
    color: semantic.textPrimary,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: typeScale.d3,
    lineHeight: typeScale.d3 * lineHeight.snug,
    color: semantic.textPrimary,
    textTransform: 'uppercase',
  },
  eyebrow: {
    fontFamily: fonts.displaySemiBold,
    fontSize: typeScale.dEyebrow,
    color: semantic.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing(typeScale.dEyebrow, tracking.label),
  },
  body: {
    fontFamily: fonts.body,
    fontSize: typeScale.tMd,
    lineHeight: typeScale.tMd * lineHeight.normal,
    color: semantic.textPrimary,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: typeScale.tSm,
    lineHeight: typeScale.tSm * lineHeight.normal,
    color: semantic.textSecondary,
  },
  /** Big numeric readouts — condensed tabular figures. */
  metric: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.d2,
    color: semantic.textPrimary,
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;

export const theme = {
  colors,
  semantic,
  runType,
  fonts,
  typeScale,
  lineHeight,
  tracking,
  spacing,
  radius,
  sizing,
  borderWidth,
  shadows,
  motion,
  textStyles,
} as const;

export type Theme = typeof theme;
export default theme;
