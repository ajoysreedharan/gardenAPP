# Garden

A phone app for a home garden in Pune: it remembers plans, when each pot was last fertilized or had its soil changed, spray courses, and season prep, and builds a 2-hour Saturday plan.

All garden data stays on your phone. Nothing is sent anywhere.

## Put it on your phone (one time)

1. Create a free account at github.com if you don't have one.
2. Create a new repository called `garden` (it can be private only on paid plans for Pages; a public repo is fine — it holds app code, never your garden data).
3. From this folder, push the code:
   ```
   git remote add origin https://github.com/<your-username>/garden.git
   git push -u origin main
   ```
4. On GitHub, open the repo → **Settings → Pages** → under *Build and deployment*, set **Source: GitHub Actions**.
5. Wait for the green tick under the **Actions** tab (about 2 minutes). Your app is at `https://<your-username>.github.io/garden/`.
6. On your Android phone, open that link in **Chrome**, tap **⋮ → Add to Home screen** (or **Install app**).

From then on, open it from the home-screen icon. It works without internet.

## First Saturday

1. Tag each pot and bed: **T-01, T-02…** on the terrace, **A-01…** on the flower balcony, **B-01…** on the leafy balcony.
2. In **Spots**, tap **+ Add spot** for each one. Use **Save & add another** to go quickly.
3. If you don't remember when you last fertilized or changed soil, leave it on **Don't know** — the app spreads those over your next three Saturdays.

## Back up

Your data lives only on the phone. About once a month: **⚙ Settings → Back up now**, and keep the downloaded file somewhere safe (e.g. Google Drive). **Restore from backup** brings it back on a new phone.

## For developers

```
npm install
npm test        # unit and screen tests
npm run dev     # local dev server
npm run build   # production build in dist/
```
