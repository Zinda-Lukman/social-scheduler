<<<<<<< HEAD
# social-scheduler
Bluesky Posts scheduler
=======
# GitHub Social Scheduler V2

GitHub Pages dashboard + GitHub Actions scheduler for Bluesky.

Features:
- Single posts
- Image posts
- Threads
- Daily/weekly/monthly recurring posts
- IANA timezone scheduling
- Automatic retries (up to 3 attempts)
- Failed-post tracking
- Persistent posting logs
- GitHub repository as storage
- No VPS required

## Files

- `index.html` — dashboard
- `style.css` — UI
- `app.js` — GitHub API dashboard
- `posts.json` — scheduled post database
- `logs.json` — scheduler log database
- `scheduler.js` — GitHub Actions publishing engine
- `.github/workflows/scheduler.yml` — 5-minute scheduler

## Required GitHub Secrets

Repository → Settings → Secrets and variables → Actions:

- `BLUESKY_HANDLE`
- `BLUESKY_APP_PASSWORD`

## Dashboard token

Create a fine-grained GitHub token restricted to this repository with:
- Contents: Read and write
- Metadata: Read-only

Enter it in Dashboard → Settings.

## GitHub Pages

Settings → Pages → Deploy from branch → `main` → `/ (root)`.

## Important

The dashboard uses the GitHub API from the browser, so the fine-grained GitHub token is stored in browser localStorage. Restrict it to this repository only.

The scheduler stores uploaded images in `media/`. Large media files are not recommended because they increase repository size.

GitHub Actions schedules are not guaranteed to execute at the exact second/minute requested. The scheduler checks every five minutes.
>>>>>>> 7df192e (Initial social scheduler)
