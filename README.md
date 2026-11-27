# Neon Serpent

A retro-neon arcade snake game that runs entirely in the browser. Plain HTML, CSS and
vanilla JavaScript on a `<canvas>` — no build step, no bundler, no CDN, no external
assets. Clone it, open it, play it.

## Description

Neon Serpent is a classic snake game with a modern presentation: a 20×20 grid, a
glowing mint serpent, and amber food. The snake grows with every bite, the tick rate
tightens as it gets longer, and the run ends the moment you meet a wall or your own
body. The best score is remembered in `localStorage` between visits.

Everything ships as static files:

| File | Purpose |
| --- | --- |
| `index.html` | The game page |
| `styles.css` | Layout, palette and responsive rules |
| `game.js` | Game loop, input handling and canvas rendering |
| `README.md` | This file |
| `LICENSE` | MIT license |
| `.nojekyll` | Makes GitHub Pages serve the folder as-is, without Jekyll processing |

## How to play

- **Steer** with the arrow keys or `W` `A` `S` `D`.
- **Pause and resume** with `Space` or `P`.
- **Restart** with `R` at any time, or with `Enter` after a game over.
- **On a phone**, swipe across the board to steer, or use the on-screen pad.
- Each food is worth **10 points**. The snake gets faster with every bite.
- The run ends if you hit a wall or yourself.

## Run it locally

The game is static, so any local web server works. From this folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000> in your browser. The folder must be served over
HTTP rather than opened as a `file://` URL, because browsers restrict `localStorage`
on local files.

Any other static server works too, for example:

```bash
npx serve .
```

## Deploy with GitHub Pages

This folder is deployed with GitHub Pages, so the game is served from the repository
root. `index.html` sits at the repository root and GitHub Pages serves it as the
site's home page.

To publish it yourself:

1. Push this folder's contents to the root of a GitHub repository.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select the branch
   and the `/ (root)` folder, and save.

Pages will serve the site at `https://<user>.github.io/<repository>/`. The included
`.nojekyll` file keeps Pages from running the folder through Jekyll, so the game is
served exactly as written.

Because everything is local — no fonts, scripts or styles from a CDN — the game also
works offline and keeps working if a third-party host disappears.

## License

MIT. See [LICENSE](LICENSE).
