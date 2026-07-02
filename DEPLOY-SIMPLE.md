# Send this app to reviewers — the simple way

Goal: turn this app into **one web link** you can email to reviewers. They just click it — no installs on their side.

You'll do this once. It takes about 10 minutes. You need two free accounts: **GitHub** (to hold the code) and **Render** (to host it). No credit card.

---

## Step 1 — Put the code on GitHub

1. Go to https://github.com and sign in (or sign up — free).
2. Click the **+** in the top-right → **New repository**.
3. Name it `cross-market-lab`. Leave everything else default. Click **Create repository**.
4. On the next page, click **uploading an existing file** (the link in the middle).
5. Unzip `cross-market-lab.zip` on your Mac (double-click it). You'll get a folder called `crossmarket`.
6. Open that folder, select **everything inside it** (all the files and folders — not the `crossmarket` folder itself), and drag them into the GitHub upload box.
7. Scroll down, click **Commit changes**.

> Tip: if you don't see hidden files like `.gitignore` in Finder, press **Cmd+Shift+.** (period) to show them. They're helpful but not essential — the app works without them.

---

## Step 2 — Deploy on Render

1. Go to https://render.com and click **Get Started** → sign in **with GitHub** (easiest — it links the two automatically).
2. In the Render dashboard click **New +** → **Web Service**.
3. Find and select your `cross-market-lab` repository. Click **Connect**.
4. Render reads the included `render.yaml` and fills in most settings. Confirm these:
   - **Build Command:** `npm run install:all && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** **Free**
5. Scroll to **Environment Variables** and add one:
   - **Key:** `FRED_API_KEY`
   - **Value:** *(paste your FRED key here)*
6. Click **Create Web Service**.

Render now builds the app. Watch the log; after a few minutes the status turns **Live** and you'll see a URL like:

```
https://cross-market-lab.onrender.com
```

**That's the link you send.** Open it yourself first to confirm it loads and pulls data.

---

## Step 3 — Send it

Copy the note in `MESSAGE-FOR-REVIEWERS.txt`, paste your live URL into it, and send.

---

## Good to know

- **First load may be slow.** On the free plan the app "sleeps" after 15 minutes of no visitors and takes ~30–60 seconds to wake on the next click. After that it's fast. (This is why the reviewer note mentions it.) If you want it always-instant, Render's paid tier is about $7/month.
- **Your FRED key stays private.** It lives only on the server as an environment variable — it is never sent to the browser, so reviewers can't see it.
- **To change anything later** (add a metric, fix a label): edit the file on GitHub, commit, and Render redeploys automatically within a couple of minutes. Adding metrics is just editing `shared-catalog.js` — see the main `README.md`.
- **If the build fails:** open the Render log and read the last few red lines. The most common cause is a missing file from the upload — re-check that everything inside the `crossmarket` folder made it to GitHub, including the `client` and `server` folders.
