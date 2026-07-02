Primary action control — Volt-filled by default; use for the single most important action on a screen.

```jsx
<Button variant="primary" full iconRight={<ArrowIcon/>}>Request to join</Button>
<Button variant="secondary">Save run</Button>
<Button variant="ghost" size="sm">Cancel</Button>
<Button variant="danger" shape="pill">Report runner</Button>
```

Variants: `primary` (Volt), `secondary` (ink/black), `ghost` (outline), `danger`, `volt-outline`.
Sizes: `sm` 40px · `md` 52px · `lg` 56px. Shapes: `rounded` · `pill` · `square`.
Labels are short, uppercase, verb-first. One Volt primary per screen.
