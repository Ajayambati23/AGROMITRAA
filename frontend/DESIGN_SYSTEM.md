# AgroMitra UI/UX Design System

**Design Philosophy:** Modern Agritech — clarity, accessibility for rural users, and strong visual feedback. Earthy tones (greens) + tech accents (blues/purples) for a "Hybrid AI" feel.

---

## 1. Color Palette

### Primary (Brand)
| Token | Hex | Tailwind | Usage |
|-------|-----|----------|--------|
| **Agro Green** | `#16a34a` | `green-600` | Primary buttons, active nav, user chat bubbles, success |
| **Deep Slate** | `#0f172a` | `slate-900` | Sidebar background, high-contrast nav |

### Secondary & Accent
| Name | Usage |
|------|--------|
| **Tech Blue** | `blue-600` → `indigo-600` gradients — Weather cards, "Get Recommendations", login |
| **Alert Orange** | `text-orange-600` / `bg-orange-100` — Pending tasks, market alerts |
| **AI Purple** | `bg-purple-100` / `text-purple-600` — Chatbot entry points, AI badges |

### Neutrals
- **Background:** `bg-gray-50` (#f9fafb)
- **Cards:** `bg-white` + `border-gray-200`
- **Headings:** `text-gray-800`
- **Subtext:** `text-gray-500`

---

## 2. Typography

- **Font:** Inter / Roboto / Segoe UI (system sans-serif)
- **Headings:** `font-bold` or `font-semibold` for section titles and key metrics
- **Body:** `text-sm` (14px) standard for UI density
- **Labels:** `uppercase tracking-wider` for items like "MARKET TREND"

---

## 3. UI Components

### Navigation Sidebar
- **Inactive:** `text-slate-400`
- **Hover:** `bg-slate-800`
- **Active:** `bg-green-600 text-white shadow-lg`

### Cards
- **Style:** `rounded-2xl`, `shadow-sm`, `border border-gray-100` or `border-gray-200`
- **Hover:** `shadow-md`

### Chat
- **User:** `bg-green-600 text-white`, `rounded-2xl rounded-br-none`
- **Bot:** `bg-white text-gray-800 border border-gray-200`, `rounded-2xl rounded-bl-none`
- **Meta:** "OFFLINE" / "CLOUD AI" in `text-[10px] opacity-60`

### Inputs
- **Default:** `bg-gray-50 border-gray-200`
- **Focus:** `ring-2 ring-green-500`
- **Padding:** `p-3` or `p-4` for touch targets

---

## 4. Layout & Hierarchy

- **Top:** Weather card (large, gradient) + Market alert (high contrast)
- **Middle:** Quick action grid (large icons, distinct colors)
- **Weather card:** 2 columns on desktop as visual anchor

### Market Price Table
- **Header:** `bg-gray-50 text-gray-600`
- **Rows:** `hover:bg-gray-50`
- **Price column:** `text-right font-bold text-green-700`

---

## 5. Icons

- **Set:** Lucide React, line icons (stroke-width: 2)
- Pair with text or background; e.g. Sprout in green circle, Sun in yellow for weather.

---

## 6. Interaction & Feedback

- **Loading:** Button text → "Processing..."; chat → "Thinking..." with bouncing dots; refresh → `animate-spin`
- **Transitions:** `transition-all duration-300` for sidebar and hovers
- **Modals:** `backdrop-blur-sm`, `bg-opacity-50`

---

## 7. Accessibility

- **Contrast:** High (gray-800 on white) for sunlight readability
- **Touch targets:** Minimum 44px height on buttons/inputs
- **Voice:** Prominent mic and speaker buttons for lower literacy users

---

## CSS Classes Reference

Use these in components:

| Purpose | Class |
|--------|--------|
| Primary button | `btn-primary` |
| Secondary button | `btn-secondary` |
| Tech/weather CTA | `btn-tech` |
| AI entry point | `btn-ai` |
| Card | `card` or `card-padded` |
| Nav item | `nav-item` / `nav-item-active` |
| User chat bubble | `chat-user` |
| Bot chat bubble | `chat-bot` |
| Chat meta text | `chat-meta` |
| Form input | `input-field` |
| Table header | `table-header` |
| Table row | `table-row` |
| Price cell | `price-cell` |
| Pending badge | `badge-pending` |
| AI badge | `badge-ai` |
| Modal backdrop | `modal-backdrop` |
| Modal panel | `modal-content` |
| Loading button | `btn-loading` |
| Spinner | `spinner` |
| Label (caps) | `label-caps` |
| Bounce dots | `animate-bounce-dots` |

Tailwind theme tokens: `primary`, `nav`, `tech`, `alert`, `ai`, `surface`, `card`, `min-h-touch`.
