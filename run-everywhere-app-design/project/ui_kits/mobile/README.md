# Run Everywhere — Mobile UI Kit

High-fidelity, interactive recreation of the Run Everywhere app, composed from the design-system primitives (`components/`). Open `index.html` for the click-through.

## Screens
- **ExploreScreen** — city map with type-colored pins, run-type pill filter, search bar, and a bottom run sheet (compact `RunCard`). Tap a pin to swap the sheet; tap the sheet to open detail.
- **RunsScreen** — "Your Runs" with ALL / MANAGED / JOINED tabs and a managed run showing an incoming-requests badge.
- **RunDetailScreen** — the highest-impact screen: route map preview with start/loop markers, type chip, title, time, dark stat strip (distance / pace / D+), the free-text goal, host block (rating + verified + message), who's-running avatars, spots-left, and a sticky **Request to join** CTA with request-sent state.
- **ProfileScreen** — ink header with avatar, rating, verified + level badges, bio, KM / RUNS / D+ stat strip, usual run types, and an "Other runners say" review list.
- **PhoneFrame** / **MapCanvas** — device shell and stylized light-map background helpers.

## Composition
Every screen imports primitives from `../../components/**` — `RunCard`, `MapPin`, `RouteMarker`, `TypeChip`, `Badge`, `Avatar`, `RatingStars`, `StatBlock`, `Button`, `IconButton`, `Tabs`, `TabBar`. The `index.html` mounts the screens from the compiled DS bundle and wires the bottom-tab navigation.

## Not yet drafted (from the brief)
Create-run full flow, Messages (list + thread + DM), join-request inbox, post-run recap, write-a-review, settings/edit-profile, filters sheet, search, notifications, and the new-city landing. The foundations + components here are built to assemble those quickly next.
