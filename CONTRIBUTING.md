# Contributing to FreeQuantumStore

Want to add a quantum computing simulation? Here's how.

## What we accept

Self-contained interactive HTML simulations. Each simulation is a single `index.html` file — no build step, no dependencies, no framework.

## Quick start

1. Create a new directory: `store/circuits/your-sim-name/`
2. Add `index.html` with your simulation
3. Add an entry to `store/registry.json`
4. Open a PR

## Design rules

| Rule | Value |
|------|-------|
| Background | `#0a0a0a` |
| Text | `#fafafa` |
| Accent | `#7c3aed` |
| Font | Manrope via Google Fonts, system-ui fallback |
| Max file size | ~30KB |
| External deps | None except Google Fonts |
| Back link | `<a class="back" href="/">Back to Store</a>` at top left |
| Cross-linking | `<script src="/related.js"></script>` before `</body>` |

## Registry entry format

Add to the `robots` array in `store/registry.json`:

```json
{
  "id": "your-sim-name",
  "name": "Your Simulation Title",
  "description": "One-line description.",
  "icon": "emoji",
  "iconBg": "#7c3aed",
  "category": "see below",
  "storeType": "behavior",
  "creator": "your-github-username",
  "creatorName": "Your Name",
  "creatorAvatar": "https://github.com/your-username.png?size=96"
}
```

## Categories

| Category | Topics |
|----------|--------|
| `gates` | Single/multi-qubit gates, circuits |
| `algorithms` | Grover, Shor, VQE, QAOA |
| `protocols` | Teleportation, QKD, error correction |
| `optimization` | Annealing, variational methods |
| `education` | Bloch sphere, measurement, entanglement |

## What makes a good simulation

- **Interactive** — user changes inputs, sees results immediately
- **Visual** — canvas, SVG, or animated HTML
- **Educational** — teaches HOW something works
- **Self-explanatory** — newcomers can understand without external docs
- **Performant** — smooth on mobile browsers
