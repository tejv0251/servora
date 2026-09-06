# Servora design context

## Thesis

Servora is a quiet control room for field-service operators. It feels calm, exact,
and trustworthy while carrying enough real information for an owner or dispatcher
to make a decision in seconds. The product is operational rather than decorative.

The defining traits are a warm-white canvas, ink-colored type, compact bordered
surfaces, an editorial display face for page titles, one deep-teal action color, and
restrained amber/red/blue status signals.

## Product shell

- Desktop: 224px navigation rail, 72px top bar, fluid content canvas.
- Tablet: navigation becomes an icon rail or drawer; content remains two-column
  where the data permits.
- Mobile: single column, sticky compact header, labelled record cards instead of
  cramped tables, and controls with at least 44px targets.
- The overview order is greeting, controls, KPIs, performance/live operations,
  technicians, attention, and activity.

## Token ownership

`app/globals.css` is the canonical runtime token source. Shared components consume
those semantic variables; feature surfaces must not introduce a parallel palette.

- Canvas `#f8f7f4`; surface `#ffffff`; ink `#17221f`; muted `#68716d`
- Border `#e8e5df`; primary `#0b675f`; primary hover `#08534d`
- Positive `#188266`; warning `#c77b12`; danger `#c94e4e`; info `#4f6fae`
- Base radius 10px; nested operational rows 7px
- Shadows are reserved for transient layers, not ordinary cards.

## Typography and components

- Product/data UI uses Geist Sans; display headings use restrained Georgia/Times.
- Currency, identifiers, dates, and percentages use tabular numerals.
- Status color is always paired with text or an icon.
- Existing Base UI/shadcn primitives own dialogs, drawers, menus, fields, and buttons.
- Native select/date controls are intentional for short English-language choices.
- Empty, loading, error, and permission states preserve stable geometry.
- The technician PWA is phone-first with a persistent connection state and one
  dominant lifecycle action.

## Avoid

Avoid decorative gradients, glass effects, excessive pills, oversized radii,
unlabelled icon actions, hidden scrollbars, and motion without operational meaning.
