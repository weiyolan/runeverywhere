Icon-only control for navigation, overflow menus, and map overlays.

```jsx
<IconButton variant="surface" round aria-label="Back"><ChevronLeft/></IconButton>
<IconButton variant="volt" aria-label="Add run"><Plus/></IconButton>
<IconButton variant="ghost" active aria-label="Favourite"><Heart/></IconButton>
```

Variants: `surface` (white, shadow — floats over maps) · `ink` · `volt` · `ghost` · `danger`.
Set `round` for circular. `active` gives the toggled ink+volt state (e.g. favourite on).
