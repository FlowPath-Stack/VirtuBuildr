# VirtuBuildr

A mobile-first **BIM modeling estimator**. Produce BIM modeling hour, cost,
and timeline estimates directly from your phone — no app store, no backend,
works offline.

## What it does

Enter a few project parameters and get an itemized estimate:

- **Inputs:** project type, floor area (ft²/m²), floors, disciplines
  (architectural, structural, MEP, fire protection, site/civil), Level of
  Development (LOD 100–500), source material (CAD, PDF, point cloud…),
  complexity, schedule, blended rate, team size, and contingency buffer.
- **Outputs:** total cost, total hours, project duration, and a
  per-discipline breakdown (modeling + coordination/clash + QA + contingency).
- **Extras:** copy a text summary, save/print to PDF, inputs persist between
  visits, and it installs to your home screen as an offline app (PWA).

## Use it on your phone

It's a static site — host it anywhere. The easiest free option is **GitHub Pages**:

1. Push this branch / merge to `main`.
2. In the repo: **Settings → Pages → Source → Deploy from branch** and pick the
   branch + root folder.
3. Open the published URL on your phone, then **Add to Home Screen** to install
   it as a standalone offline app.

To run locally:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

Opening `index.html` directly works too, but the offline service worker only
activates when served over http(s).

## How the estimate is calculated

The engine is fully transparent and parametric — see `app.js`:

```
hours_per_discipline =
    (area_ft² / 1000) × base_rate × project × LOD × source × complexity
total = (modeling + coordination + QA) × (1 + contingency) × schedule
cost  = total_hours × blended_rate
```

Base productivity rates (hours per 1,000 ft² at LOD 300) live at the top of
`app.js` in the `DISCIPLINES` array. **These are industry-rough starting
points — calibrate them against your firm's historical projects** for reliable
numbers.

## Files

| File | Purpose |
|------|---------|
| `index.html` | App markup / form |
| `styles.css` | Mobile-first dark UI |
| `app.js` | Estimation engine + interactions |
| `manifest.json`, `sw.js`, `icon.svg` | PWA install + offline support |

> Estimates are for planning only.
