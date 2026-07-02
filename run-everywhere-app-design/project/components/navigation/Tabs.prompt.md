Segmented tab control for section and toggle navigation.

```jsx
<Tabs variant="underline" value={tab} onChange={setTab}
  items={[{id:'all',label:'All'},{id:'mine',label:'Managed by you'},{id:'joined',label:'Joined',count:3}]} />

<Tabs variant="pill" full={false} value={view} onChange={setView}
  items={[{id:'map',label:'Map'},{id:'list',label:'List'}]} />
```

`accent` recolors the active state — pass `var(--discover)` etc. for run-type tabs.
