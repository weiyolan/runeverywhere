Text field with bold uppercase micro-label; supports adornments and multiline.

```jsx
<Input label="Run goal" multiline rows={3}
  placeholder="Easy social 5k to see the old town…" />
<Input label="Distance" trailing={<span>km</span>} type="number" />
<Input label="Email" hint="We never share this" />
```

Set `multiline` for the free-text goal / bio. `leading`/`trailing` take units or icons. `invalid` + `hint` show error state.
