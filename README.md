# Save & Tell 📚🎮
A pixel-art gamer's journal library. Keep a quest log for every game: timestamped notes, snapshots, custom books, themes, trophies, and a little window that shows your real sky.

## Install with GitHub Pages
1. Create a new **public** repo on GitHub (for example `save-and-tell`).
2. Upload **everything in this folder** to the root of the repo: `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest`, `README.md`, and the `icons` folder.
3. Go to **Settings → Pages**, set **Source** to *Deploy from a branch*, then pick **main** and **/ (root)**, and select **Save**.
4. After a minute, open `https://YOUR-USERNAME.github.io/save-and-tell/` in **Safari** on your iPhone.
5. Tap **Share → Add to Home Screen**. Launch it from the icon so it runs full screen and works offline.

## Notes
- **Data** is stored on your device (IndexedDB). Use **Settings → Export** to make a backup `.json`, and **Restore** to bring it back (merge or replace).
- **Weather** comes from Open-Meteo (free, no API key). Location is requested once on first launch. You can change how often it refreshes in Settings.
- **Rotation:** the layout stays in portrait even when the phone is turned.
- **Updating:** upload the new files over the old ones. If you change files later, bump `VERSION` in `sw.js` so phones pick up the update.
