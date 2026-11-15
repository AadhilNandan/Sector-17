/**
 * SECTOR 17 — THE LAST EXPEDITION
 * Design Tokens & Visual Foundations (Phase 7.2.1)
 *
 * Identity: "THE EXPEDITION RECORD"
 * 85% Grounded Aerospace Realism / 15% Deep-Space Mystery
 */

export const tokens = {
  colors: {
    // Grounded Foundation Palette
    void: '#07090C',
    hull: '#0D1116',
    panel: '#151B22',
    panelRaised: '#1C242D',
    rule: '#2B3642',

    // Text Hierarchy
    textPrimary: '#E6E2D6',
    textSecondary: '#A9B0B5',
    textMuted: '#6B757D',

    // Functional Status & Accents
    signalIce: '#7FB7D4',
    cautionAmber: '#E0A43A',
    faultRed: '#D8503F',
    nominalGreen: '#6FAE7C',
    jovianOchre: '#B5733C',
    europaIce: '#8FB8CC',

    // Restricted Anomaly Palette
    omegaLume: '#D8E6A0',
    omegaUmber: '#2A2218',

    // Backward-Compatibility Aliases
    background: {
      voidBlack: '#07090C',
      deepSpace: '#0D1116',
      midnightNavy: '#151B22',
      panelSurface: '#151B22',
      elevatedSurface: '#1C242D',
    },
    text: {
      primary: '#E6E2D6',
      secondary: '#A9B0B5',
      muted: '#6B757D',
    },
    accent: {
      missionAmber: '#E0A43A',
      warmGold: '#B5733C',
      technicalCyan: '#7FB7D4',
      successGreen: '#6FAE7C',
      warningAmber: '#E0A43A',
      criticalRed: '#D8503F',
    },
  },
  typography: {
    display: '"Barlow Condensed", system-ui, -apple-system, sans-serif',
    interface: '"IBM Plex Sans", system-ui, -apple-system, sans-serif',
    technical: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace',
    narrative: '"Newsreader", Georgia, serif',
  },
  geometry: {
    radius: '2px',
    borderWidth: '1px',
    borderColor: '#2B3642',
  },
} as const;

export type ThemeTokens = typeof tokens;
