---
name: Aether Daybreak
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3f4850'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#707881'
  outline-variant: '#bfc7d2'
  surface-tint: '#006398'
  primary: '#006194'
  on-primary: '#ffffff'
  primary-container: '#007bb9'
  on-primary-container: '#fdfcff'
  inverse-primary: '#93ccff'
  secondary: '#00677d'
  on-secondary: '#ffffff'
  secondary-container: '#63dbfe'
  on-secondary-container: '#005e73'
  tertiary: '#8d4b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#b15f00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cce5ff'
  primary-fixed-dim: '#93ccff'
  on-primary-fixed: '#001d31'
  on-primary-fixed-variant: '#004b73'
  secondary-fixed: '#b3ebff'
  secondary-fixed-dim: '#5cd5f8'
  on-secondary-fixed: '#001f27'
  on-secondary-fixed-variant: '#004e5f'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-mobile: 0.75rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system defines the daytime interface for high-fidelity audio streaming and broadcast curation. Tailored for discerning listeners, podcasters, and audiophiles, it conveys structural precision, airiness, and effortless navigational clarity. 

The aesthetic is built on disciplined minimalism and functional utility, reflecting the restraint of contemporary industrial hardware and Apple-caliber typographic hierarchy. Rather than relying on dark skeuomorphism or artificial neon luminescence, the interface foregrounds vibrant album artwork, waveform geometry, and editorial typography against crisp slate-white planes. Visual priority remains strictly anchored to content discovery, playback telemetry, and tactile audio controls.

## Colors

The palette balances clinical precision with calculated accents to keep the user focused on soundscapes and editorial media:

- **Base Surfaces & Canvases**: The foundational canvas rests on `#F8FAFC`, stepping up to `#FFFFFF` for primary content cards, elevated player decks, and modals. Subtle container tiers utilize `#F1F5F9` and `#E2E8F0` to compartmentalize content without introducing visual weight.
- **Accents**: 
  - The primary electric sky blue (`#0284C7`) and azure (`#00A3C4`) direct interactive state changes, progress scrubbers, live broadcast beacons, and active toggle markers.
  - The warm amber/gold tier (`#D97706` / `#F59E0B`) is reserved strictly for VIP passes, lossless master badges, and curated host endorsements.
- **Text & Contrast Hierarchy**: Text values leverage crisp Slate scales to guarantee AA/AAA compliance against luminous backgrounds. Primary headlines use `#0F172A`, supporting body text relies on `#334155`, and metadata, timestamps, and secondary captions sit at `#64748B`.
- **Structural Outlines**: Dividers and borders rely on precise, hairline rules (`#E2E8F0` or `rgba(15, 23, 42, 0.06)`).

## Typography

Typography is calibrated using Inter across all touchpoints, emphasizing structural clarity, tight tracking for high-impact numerals, and generous line spacing for extended liner notes:

- **Editorial Displays**: Large displays use negative tracking (`-0.02em`) with weight anchored at `700` to anchor station hero cards and featured episode releases.
- **Track Metadata**: Body and label hierarchies feature balanced weights (`400` to `600`) to clearly delineate artist credits from album titles and timestamps at a glance.
- **Micro Telemetry**: Bitrate indicators, kHz sampling labels, and elapsed time badges strictly leverage `label-sm` or `label-md` with tabular numerals enabled (`font-variant-numeric: tabular-nums`) to prevent horizontal jitter during real-time playback updates.

## Layout & Spacing

The spatial engine uses an 8pt base grid with a fluid layout structure, ensuring responsive scaling across desktop workstations, tablet mixing consoles, and mobile viewports:

- **Grid Architecture**: 
  - **Desktop (1024px+)**: 12-column layout with fixed persistent side navigation (280px), `1.25rem` gutters, and `2rem` outer section margins.
  - **Tablet (768px - 1023px)**: 8-column layout with collapsing navigation rail (72px), `1rem` gutters, and `1.5rem` outer margins.
  - **Mobile (< 768px)**: 4-column layout with sticky bottom audio player deck (64px safe area clearance), `0.75rem` gutters, and `1rem` lateral padding.
- **Density & Touch Targets**: Interactive controls maintain a minimum target boundary of 44x44px. Audio progress scrubs and volume faders rely on extended invisible hitboxes (`space-md`) over compact 4px visual tracks.

## Elevation & Depth

Depth in this system avoids heavy dropshadows, relying on deliberate tonal stacking paired with soft ambient diffusion:

- **Level 0 (Base Canvas)**: Flat `#F8FAFC` surface with zero elevation.
- **Level 1 (Cards & Static Grids)**: `#FFFFFF` resting on `#F8FAFC`, bounded by a hairline border of `1px solid #E2E8F0`. No shadow is applied under neutral states.
- **Level 2 (Hover States & Detached Bars)**: Dynamic components receive a diffuse micro-shadow: `0 4px 16px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.03)`.
- **Level 3 (Sticky Bottom Player & Overlays)**: Floats above all page content with subtle frosted translucent layering: `background: rgba(255, 255, 255, 0.88); backdrop-filter: blur(16px);`, supported by a top border `1px solid rgba(226, 232, 240, 0.8)` and a soft uplift shadow `0 -8px 24px rgba(15, 23, 42, 0.04)`.
- **Level 4 (Modals & Volume Menus)**: Focused center overlays feature `box-shadow: 0 20px 40px -8px rgba(15, 23, 42, 0.12), 0 1px 3px rgba(15, 23, 42, 0.04)` combined with an ambient dimming backdrop (`rgba(15, 23, 42, 0.25)`).

## Shapes

The geometric framework is grounded at roundedness level `2` (`0.5rem` / 8px base radius), producing a modern, balanced silhouette:

- **Standard Containers & Covers**: Album artworks, episode thumbnail cards, standard input elements, and modular grid cells strictly use base roundedness (`0.5rem`).
- **Surface Panels & Modals**: Larger panels and full-screen drawer headers step up to `rounded-lg` (`1rem`) to maintain proportional visual harmony.
- **Interactive Control Elements (Pill Exception)**: Streaming controls, category filter pills, scrubber thumbs, playback primary action buttons (Play/Pause), and live broadcast indicator tags take fully pill-shaped contours (`rounded-full` / `9999px`) to facilitate fluid drag gestures and quick thumb acquisition.

## Components

### Buttons
- **Primary Action (Play/Resume)**: Solid `#0284C7` background, `#FFFFFF` text and icons. Pill-shaped (`rounded-full`), padding `10px 24px`. Micro-hover: `#0369A1` with an ambient glow (`box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25)`).
- **Secondary (Follow/Queue)**: `#F1F5F9` background, `#0F172A` text, `1px solid #E2E8F0`. Hover shifts background to `#E2E8F0`.
- **Ghost & Icon Controls**: Transparent base, `#334155` foreground, `rounded-full` hover background of `#F1F5F9`.

### Chips & Filters
- Compact height (32px), pill-shaped, `1px solid #E2E8F0`, background `#FFFFFF`.
- In active state, background shifts to `#0F172A` with `#FFFFFF` text or `#0284C7` with `#FFFFFF` for primary tags.
- VIP/Exclusive chips feature `#FEF3C7` background, `#B45309` text, and `#FCD34D` outline.

### Lists & Track Rows
- Row items sit flush inside a vertical stack, separated by hairline dividers (`#F1F5F9`).
- Hover triggers full-row background illumination using `#F8FAFC` with rounded transitions (8px).
- Columns align track number / equalizer icon, track artwork (40x40px, rounded-md), title (`#0F172A`), artist (`#64748B`), duration, and trailing context menu.

### Inputs & Scrubbers
- **Search Bar**: Height 40px, background `#F1F5F9`, border `1px solid transparent`, text `#0F172A`, placeholder `#94A3B8`. Focus state introduces a crisp ring of `2px solid #0284C7` with background turning to `#FFFFFF`.
- **Audio Progress Fader**: 4px track height. Base background `#E2E8F0`; buffered progress `#CBD5E1`; played progress `#0284C7`. Interactive scrubber thumb (12px circular disk `#FFFFFF` with `#0284C7` center core) appears on hover.

### Checkboxes & Radios
- 18x18px squares (checkbox) with 4px radius, and circles (radios). Border `1.5px solid #CBD5E1`.
- Checked state fills with `#0284C7` displaying a crisp white micro-tick or center dot.

### Cards & Mini Player
- **Content Cards**: `#FFFFFF` surface, `1px solid #E2E8F0`, 8px padding around album art, followed by primary title (`body-md` bold) and subtitle (`body-sm` muted).
- **Persistent Player**: Docked 72px horizontal panel with a multi-layered frosted background, hosting left-aligned album art/metadata, centered transport controls (Shuffle, Prev, Play/Pause, Next, Repeat), and right-aligned volume fader and output device switcher.