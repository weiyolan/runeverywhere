The core discovery object — a planned run, color-coded by type.

```jsx
<RunCard
  type="discover"
  title="Sunrise Old-Town Loop"
  goal="Easy social 5k to see the old town and the river path."
  host={{ name: "Maya Okafor", rating: 4.9, verified: true }}
  distance="5.2 km" pace="5:30 /km" when="Tomorrow · 07:00"
  city="Lisbon" spotsLeft={4} closedLoop
  attendees={[{name:'T'},{name:'A'},{name:'J'},{name:'K'}]}
  onClick={openDetail}
/>
```

Variants: `default` (list) · `compact` (map sheet/search, hides goal) · `feature` (hero, big shadow).
`spotsLeft <= 0` auto-renders a FULL badge; `<= 2` warns amber.
