# LEGO Set Inventory

Drill into any LEGO set and see every part — including each minifigure broken
out into its component pieces, with rare elements flagged.

Data comes from the [Rebrickable](https://rebrickable.com) v3 API, proxied
through a serverless function so the API key never reaches the browser.

## What's here

```
src/App.jsx              search bar, demo/live switching, error states
src/Browse.jsx           theme hierarchy, year filters, set grid
src/SearchResults.jsx    set-name and character-name search
src/SetInventory.jsx     the UI — figure roster, exploded diagram, brick grid
src/lib/rebrickable.js   API client: pagination, slot derivation, rarity
src/lib/useSetInventory.js  React hook, staged loading
api/rebrickable.js       serverless proxy (hides the key, allowlists paths)
```

The app runs in demo mode with sample data until you enter a set number, so it
works the moment it's deployed — even before you add an API key.

## Deploy

1. Push this folder to a GitHub repository.
2. Import the repository at [vercel.com/new](https://vercel.com/new). Accept the
   detected settings (Vite) and deploy.
3. Get an API key: Rebrickable → your profile → Settings → API.
4. In Vercel: Settings → Environment Variables → add `REBRICKABLE_KEY`.
5. Redeploy (Deployments → latest → Redeploy) so the function picks up the key.

## Run locally

```bash
npm install
npm run dev          # demo mode only — the /api function does not run
```

To exercise the live API locally you need the function too:

```bash
npm i -g vercel
vercel dev           # serves the app and /api on one port
```

Create `.env.local` with `REBRICKABLE_KEY=your_key_here` for local runs. It's
gitignored — don't commit it.

## Notes

**Browsing.** Themes are hierarchical and sets are filed against the most
specific theme, not its ancestors — so a parent like Star Wars often has no sets
of its own and the subthemes hold them all. The Browse tab leads with subthemes
for that reason. The full theme list is fetched once and cached.

**Searching.** The top bar has three modes. Set number loads a set directly.
Set name and Character search the whole catalogue; character results expand to
show every set that figure appears in, fetched only when expanded.

**Characters vs parts.** Animals appear in the roster only when the name
describes a whole creature. The head noun decides it: "Horse with Moveable Legs"
is a horse, "Dinosaur Tail" is a tail. Bit parts stay in the Bricks tab.

**Grouped results.** Character search groups variants under the base name, since
Rebrickable catalogues every printing separately and a common character
otherwise returns dozens of near-identical rows.

**Rare part navigation.** A part in 2–3 sets shows a link to the others, so a
rare element becomes a route to related sets. Unique parts (1 set) have nowhere
to go and show no link.

**Set numbers need a variant suffix.** `75192` is normalized to `75192-1`
automatically.

**Rarity** comes from `num_sets` on each inventory row — how many sets that
exact part *and colour* combination appears in. A part with 3 or fewer is
flagged. When a lookup fails the value is null, which renders as "Rarity
unknown" rather than being treated as rare.

**Minifig slots** (head, torso, legs, headgear) aren't labelled by the API. They
are derived from the part category, falling back to the part name. Anything
unmatched becomes an accessory.

**Rate limits.** Rebrickable throttles at roughly 100 calls per minute. The
client caps concurrency accordingly and the proxy caches hard at the edge, since
catalog data rarely changes.

**The proxy only permits catalog reads.** User-account endpoints are rejected by
the allowlist in `api/rebrickable.js`. Add paths there if you extend it.

## Troubleshooting

| What you see | Fix |
| --- | --- |
| "No API key configured" | Add `REBRICKABLE_KEY` in Vercel, then redeploy |
| "Rebrickable rejected the API key" | Key is wrong or has extra whitespace |
| "No set numbered X" | Try the `-1` suffix, or check the number on rebrickable.com |
| "Path not available through this proxy" | Add the path to `ALLOWED` in `api/rebrickable.js` |
| "The API proxy did not respond" | `api/rebrickable.js` is missing from the repo, or the deploy predates it |
| Blank page after deploy | Check the build log; confirm the output directory is `dist` |
