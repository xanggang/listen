---
name: Midnight Sonic
colors:
  surface: '#0e1321'
  surface-dim: '#0e1321'
  surface-bright: '#343948'
  surface-container-lowest: '#090e1c'
  surface-container-low: '#161b2a'
  surface-container: '#1a1f2e'
  surface-container-high: '#252a39'
  surface-container-highest: '#303444'
  on-surface: '#dee2f6'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#dee2f6'
  inverse-on-surface: '#2b303f'
  outline: '#849495'
  outline-variant: '#3a494b'
  surface-tint: '#00dce6'
  primary: '#e0fdff'
  on-primary: '#00373a'
  primary-container: '#00f2fe'
  on-primary-container: '#006a70'
  inverse-primary: '#00696f'
  secondary: '#d0bcff'
  on-secondary: '#3c0091'
  secondary-container: '#571bc1'
  on-secondary-container: '#c4abff'
  tertiary: '#e1ffec'
  on-tertiary: '#003824'
  tertiary-container: '#67f4b7'
  on-tertiary-container: '#006e4b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ff6ff'
  primary-fixed-dim: '#00dce6'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f53'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0e1321'
  on-background: '#dee2f6'
  surface-variant: '#303444'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-sm: 0.75rem
  gutter-lg: 1.5rem
  margin: 1rem
  margin-tablet: 2rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system crafts an immersive, late-night sonic atmosphere for global internet radio exploration. It balances the tactile clarity of professional studio mixing boards with the fluidity of modern digital streaming platforms. The mood is nocturnal, exploratory, and luminous: navigating thousands of worldwide frequencies should feel like flying over illuminated metropolitan skylines at 30,000 feet.

### Aesthetic Pillar
The visual style relies on **Glassmorphism blended with Deep Dark-Mode Tonal Layering**. Deep midnight space is carved out through charcoal-navy surfaces, translucent frosted overlays, and surgical neon signal indicators. Electric cyan provides an immediate visual tether for interactive audio states, while radio-violet complements the depth with tonal harmony, and live-signal green delivers instant spatial reassurance for on-air broadcasts.

### Key Experiential Tenets
- **Signals in the Dark:** True background states remain deep and quiet, allowing glowing stations, frequencies, and waveform visualizers to act as primary focal landmarks.
- **Ergonomic Tactility:** Pill-shaped controls, oversized hit targets, and continuous scrubbing gestures offer effortless one-handed thumb interaction during passive listening.
- **Fluid Translucency:** Floating glass panels (mini-player, navigation bar) retain ambient background context while navigating deep directory structures or 3D globe views.

## Colors

The palette simulates high-end audio engineering gear operating in a darkened broadcast booth. High contrast, precise luminance ratios, and disciplined usage of saturated accents maintain high accessibility and focus.

### Palette Architecture
- **Primary (`#00f2fe` - Electric Cyan):** The primary signal token. Denotes focused states, current audio playback tracks, active scrubber handles, active station frequency nodes, and primary action buttons.
- **Secondary (`#8b5cf6` - Radio Violet):** The ambient resonance token. Applied to genre badges, exploratory carousels, secondary interactive states, and gradient sweeps across featured broadcast banners.
- **Tertiary (`#10b981` - Live Signal Emerald):** Reserved strictly for real-time status: "ON AIR" indicators, low-latency live streams, bitrate quality badges, and ping metrics.
- **Neutral Canvas (`#0a0f1d` / `#111827`):** Midnight Navy canvas and Charcoal surface containers. These deep blues prevent muddy charcoal grays while avoiding the eye-fatigue of harsh OLED pure blacks.

### Functional Surface Roles
- **Base Canvas:** `#0a0f1d` (Root page backdrop).
- **Surface Elevation 1 (Cards, Lists):** `#111827` with 60% opacity when paired with backdrop blur, or `#162032` solid.
- **Surface Elevation 2 (Floating Mini-Player, Modals):** `#1c283f` with 80% backdrop blur (`rgba(28, 40, 63, 0.8)`).
- **Surface Borders / Ghost Rings:** `rgba(255, 255, 255, 0.08)` to clearly separate layers without hard color borders.
- **Typography Primary:** `#f8fafc` (Slate 50) for maximum clarity against deep navy.
- **Typography Secondary:** `#94a3b8` (Slate 400) for station metadata, bitrates, and artist subtitles.

## Typography

The type scale combines the open, geometric curves of **Plus Jakarta Sans** for station brands and expressive headings with the rigorous legibility of **Inter** for dense metadata (frequencies, countries, bitrates, track histories).

### Typographic Hierarchy Rules
- **Display & Headlines:** Used for station titles, city names, and major curated collections. Rendered in high-contrast light slate with tight letter-spacing to reinforce a punchy broadcast identity.
- **Labels (`label-sm`):** Rendered in uppercase with generous tracking (`0.06em`) for technical indicators like `128 KBPS`, `FM 94.9`, `LIVE`, or `STEREO`.
- **Numerics:** In player scrubbing bars, station frequencies, and clock counters, use tabular figures (`font-variant-numeric: tabular-nums`) to prevent jitter during real-time streaming updates.

## Layout & Spacing

The layout is built around a standard 4-column mobile grid system scaling to 8 columns on tablet and 12 columns on desktop. Spacing is strictly optimized for thumb-reach regions, incorporating dedicated bottom-clearance zones for persistent media players.

### Spacing Principles
- **Base Grid:** 4px baseline unit (`0.25rem`). All paddings and component gaps scale uniformly in multiples of 4px.
- **Screen Margins:** Fixed 16px (`1rem`) on phones to maximize visual canvas for map coordinates and radio cards; expands to 32px on tablet devices.
- **Audio Deck Clearance:** All main scrollable viewports must enforce a bottom padding offset equal to `MiniPlayer Height (64px) + Bottom Bar (56px) + Safe Area Gap (16px) = 136px` to prevent content occlusion.
- **Horizontal Carousels:** Station carousels break outside the 16px screen margin using negative margins, snapping cleanly with an 8px leading peak to invite horizontal exploration.

## Elevation & Depth

Visual hierarchy uses frosted glassmorphic layers and neon-tinted radial glows rather than traditional opaque drop shadows. Surfaces float at defined vertical strata:

### Elevation Planes
1. **Base Stream (Level 0):** Pure dark background (`#0a0f1d`) hosting map visualizers, spectrum graphics, and directory lists.
2. **Card Layer (Level 1):** Solid `#111827` or translucent `rgba(17, 24, 39, 0.75)` with `1px` subtle outline (`rgba(255, 255, 255, 0.06)`). No box-shadow needed.
3. **Floating Controls & Mini-Player (Level 2):** Translucent `#1c283f` at 85% opacity, `backdrop-filter: blur(20px)`, framed by an inner top edge highlight (`border-top: 1px solid rgba(255, 255, 255, 0.15)`). Ambient shadow: `0 16px 32px -8px rgba(0, 0, 0, 0.65)`.
4. **Active Playback Glow (Signal Level):** When a station is active, the playing element projects a localized electric cyan radial aura: `box-shadow: 0 0 24px -4px rgba(0, 242, 254, 0.35)`.
5. **Full Player Modal (Level 3):** Modal sheets sliding from the bottom utilize `backdrop-filter: blur(32px)` over dynamic album/station artwork with a dark gradient scrim (`rgba(10, 15, 29, 0.92)`).

## Shapes

The design system incorporates full pill and smooth organic geometry (`roundedness: 3`), establishing a fluid, human-centered physical feel.

### Geometric Conventions
- **Pill Primitives (`border-radius: 9999px`):** Applied uniformly to primary CTAs, transport control pods, audio scrubber heads, search inputs, and genre filter pills.
- **Surface & Panel Containers:** Outer cards and sheets use `rounded-lg` (32px / `2rem`) and `rounded-xl` (48px / `3rem`) to create smooth, non-aggressive modular bounding boxes.
- **Album / Station Artwork:** Album art and broadcast logos retain a slightly tighter squircle curvature (`rounded-md` / 16px) to avoid clipping critical identity marks while harmonizing with surrounding pill containers.

## Components

### Buttons & Transport Controls
- **Play/Pause Hero Control:** A 64px circular or pill-extended button wrapped in solid Electric Cyan (`#00f2fe`) with `#0a0f1d` deep ink icon typography. Emits a smooth pulsing cyan ring during track buffering.
- **Secondary Buttons:** Pill containers with translucent background (`rgba(255, 255, 255, 0.08)`), crisp `1px` border (`rgba(255, 255, 255, 0.12)`), and white text. Hover/Active transforms to `rgba(255, 255, 255, 0.16)`.
- **Haptic Transport Buttons:** Skip, rewind, and frequency seek buttons are borderless icon discs with transparent default states and high-glow hover feedback.

### Chips & Filter Pills
- **State Selection:** Used for filtering by country, genre (e.g., Ambient, Jazz, Synthwave), or frequency band (FM, AM, DAB).
- **Default State:** Pill shape, dark slate surface (`#162032`), text in `#94a3b8`.
- **Selected State:** Solid secondary purple (`#8b5cf6`) or primary cyan border with soft gradient fill (`rgba(0, 242, 254, 0.12)`), text in `#00f2fe`.

### Persistent Bottom Mini-Audio Player
- **Form Factor:** Floating pill container suspended 12px above the bottom navigation bar.
- **Structure:** 64px height, frosted glass backdrop (`blur(20px)`), subtle `1px` border (`rgba(255, 255, 255, 0.1)`). Left side displays rotating thumbnail artwork with emerald broadcast ring; center displays auto-scrolling station and track name; right side features quick favorite and instant Play/Pause toggle.
- **Scrubber Integration:** A 2px cyan line runs flush along the bottom edge of the mini player, visualizing stream buffer and playback continuity.

### Station Cards & Carousels
- **Featured Station Card:** 240px wide aspect ratio cards. Features rich photography or city skyline gradients, topped with a glass badge displaying country flag + bitrate. A live sound-wave visualizer animates in the corner when the card represents the current stream.
- **Live Indicator Tag:** Pill badge containing a tertiary emerald (`#10b981`) dot with CSS ripple pulse, accompanied by bold uppercase `LIVE` in 10px tracking.

### Lists & Channel Rows
- **List Item:** Height 64px. Contains station avatar (44px squircle), station title in `Plus Jakarta Sans` semi-bold, location and kilohertz info in `Inter` body-sm, and frequency metric pinned to the trailing edge. Hover/Pressed state activates a subtle horizontal cyan glow on the left border.

### Input Fields & Frequency Dial
- **Search & Frequency Inputs:** Full pill enclosures with recessed dark fill (`#080c17`). Left-aligned search glass icon in slate. Focused state replaces default border with a luminous `#00f2fe` ring.
- **Frequency Wheel / Slider:** Horizontal scrubbing bar with graduation marks spaced at 0.1 MHz intervals. The center indicator pin stays fixed in glowing cyan while the ruler slides beneath with haptic ticks.