---
name: Lumen
description: Local-first e-reader as a planetarium control booth — deep void, one warm star, chrome that dims for the show.
colors:
  void: "#0B0E14"
  void-elevated: "#121722"
  void-panel: "#181E2A"
  star: "#E8A54B"
  star-soft: "#F0C27A"
  star-muted: "#A67B3D"
  ink: "#E8E6E1"
  ink-dim: "#9A9A96"
  ink-faint: "#5C5F6A"
  hairline: "#2A3142"
  paper: "#F2EFE8"
  paper-ink: "#1A1C22"
  sepia: "#E8DCC8"
  sepia-ink: "#3D3428"
  contrast-bg: "#000000"
  contrast-fg: "#FFFFFF"
  danger: "#E07070"
typography:
  display:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 550
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "0.01em"
  ui:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 450
    lineHeight: 1.4
  label:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.02em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  2xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.star}"
    textColor: "{colors.void}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
  panel:
    backgroundColor: "{colors.void-panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: Lumen

## Overview

**Creative North Star: "Planetarium control booth"**

Lumen is a night-reading instrument, not a leather-bound facsimile. The surface is a deep void like a darkened dome; the only warm light is a single star accent used sparingly for primary action and progress. Library chrome behaves like instrument panels; once a book opens, panels dim and recede so the text is the projection.

Reading is continuous showtime. Motion is short and physical (fade, soft slide), never decorative strobe. Typography splits duty: a geometric sans (Sora) for UI and catalog, a dedicated reading face (Source Serif 4) only inside the reading column where long-form comfort matters.

**Key Characteristics:**
- Deep blue-black void, not pure marketing black
- One warm star accent (≤10% of chrome)
- Instrument panels with hairlines; no heavy glass stacks
- Auto-hiding reader chrome ("lights down")
- Restrained motion, 150–250ms product timing

## Colors

Restrained palette: neutrals plus one star accent. Theme modes recolor the reading stage only.

### Primary
- **Star** (`#E8A54B`): primary buttons, progress edge, focus rings, continue-reading cue. Rarity is the point.

### Neutral
- **Void** (`#0B0E14`): app shell default (Night).
- **Void elevated / panel** (`#121722` / `#181E2A`): library cards, sheets, floating islands.
- **Ink / dim / faint**: text hierarchy on void.
- **Hairline** (`#2A3142`): borders and dividers only.

### Reading stage themes
- **Night**: void + ink (default).
- **Paper**: `#F2EFE8` ground, dark ink.
- **Sepia**: `#E8DCC8` ground, warm ink.
- **High contrast**: pure black/white for a11y.

**The One Star Rule.** Accent appears on primary actions, progress, and focus — never as large background washes or multi-hue gradients.

## Typography

**Display/UI Font:** Sora (system-ui fallback)  
**Reading Font:** Source Serif 4 (Georgia fallback)  
**Character:** UI is precise and modern; body is only for long-form reading columns.

### Hierarchy
- **Display** (Sora 600, ~1.75rem): library title, empty-state headline.
- **Title** (Sora 550, ~1.125rem): book titles, sheet headers.
- **UI** (Sora 450, 0.875rem): controls, metadata.
- **Label** (Sora 500, 0.75rem): secondary meta, progress %.
- **Body** (Source Serif 4, 1.125rem+, lh 1.65–1.8): reader only; measure **65–75ch**.

**The Stage Type Rule.** Serif never appears in buttons, nav, or library chrome — only in the reading column (and optional cover typography).

## Layout

- Library: max content ~1120px, generous outer padding, asymmetric continue strip above cover grid.
- Reader: full-bleed stage; text column centered with adjustable max-width; floating island chrome top/bottom.
- Spacing rhythm: tight within groups, `xl`/`2xl` between sections.
- Mobile: single column, bottom-safe floating controls, 44px min targets.

## Elevation & Depth

Tonal layering over heavy shadows. Panels sit one step above void; islands use a soft tinted shadow only when floating over the reading stage.

- **Rest:** flat tonal step (void → panel).
- **Float:** `0 12px 40px rgba(0,0,0,0.35)` tinted toward void, hairline border.
- **No neon outer glows.**

**The Flat Booth Rule.** Depth is a small step, not a stack of glass cards.

## Shapes

- Controls: pill (`999px`) for primary actions and icon buttons.
- Panels/cards: 12–16px (`md`/`lg`).
- One radius system; no mixed sharp/soft without role.

## Components

### Buttons
- Primary: star fill, void text, pill, press scale 0.98.
- Ghost: transparent, hairline optional, ink text.
- Focus-visible: 2px star ring offset.

### Library cards
- Panel surface, hairline, cover area 2:3, progress as thin bottom edge in star.
- Hover: slight lift (transform only), no color rainbow.

### Reader chrome (Island)
- Floating pill/bar, void-panel + hairline, auto-hide after idle.
- Progress: 2px star track at top or bottom edge of viewport.

### Inputs
- Panel fill, hairline border, star focus border; labels above fields.

### Empty state
- Large quiet headline + star primary "Import book" + drag target with dashed hairline.

## Do's and Don'ts

### Do:
- **Do** default to Night void and keep star rare.
- **Do** hide reader chrome in focus mode and on idle.
- **Do** keep reading measure 65–75ch and type controls obvious.
- **Do** honor `prefers-reduced-motion` (instant state, no page-turn flair).

### Don't:
- **Don't** use cream-paper + terracotta as the app shell (paper is a *reading theme* only).
- **Don't** use purple AI gradients, neon edges, or Inter as brand identity.
- **Don't** put serif type on library chrome or buttons.
- **Don't** require account or network to open a local book.
