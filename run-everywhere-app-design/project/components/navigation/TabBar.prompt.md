Bottom navigation bar with a floating Volt center Create button. Locked IA.

```jsx
<TabBar value={tab} onChange={setTab} onCreate={openCreate}
  items={[
    {id:'explore', label:'Explore', icon:<Compass/>},
    {id:'runs',    label:'Runs',    icon:<Route/>},
    {id:'messages',label:'Chat',    icon:<Chat/>},
    {id:'profile', label:'You',     icon:<User/>},
  ]} />
```

Pass exactly 4 items; the center (+) is always Create. Active tab glyph turns Volt.
