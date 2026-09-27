# TaskFlow — Task Management App

A fast, focused task manager for a single person juggling several projects.
Built with plain HTML, CSS, and JavaScript — no frameworks, no build step,
no backend.

## Features

- **Capture → Organize → Prioritize → Schedule → Complete** in one screen,
  no extra navigation.
- Projects: create, rename, delete, and see a task count per project.
- Tasks: title, description, due date, priority (low/medium/high), status
  (to do/in progress/completed), and an optional project.
- Views: All tasks, Today, Upcoming, Completed, Overdue.
- Filters by priority and status, plus free-text search.
- Sort by due date, priority, created date, or A–Z.
- Dashboard with five live counts (all / due today / in progress /
  completed / overdue).
- Light and dark theme (remembers your choice, and defaults to your
  system preference on first visit).
- Keyboard shortcuts: `/` focuses search, `n` focuses quick-add,
  `Esc` closes any open dialog.
- Confirmation dialog before any delete, toast feedback on every action,
  and empty states that explain what to do next.
- Fully responsive — the project list collapses behind a menu button on
  small screens.
- **Data persistence**: everything is saved to the browser's
  `localStorage`, so it survives a refresh. There is no server and no
  account system — data lives only in the browser it was created in.

## Tech stack, and why

| Layer | Choice | Why |
|---|---|---|
| Structure | HTML5 | No component framework needed for one page. |
| Styling | Plain CSS with custom properties (variables) | Handles light/dark theming and responsiveness without a build step. |
| Behavior | Vanilla JavaScript (ES6+) | The brief explicitly forbids a backend, a database, and external APIs — this app only needs to read/write `localStorage` and update the DOM, which plain JS does natively. |
| Storage | `window.localStorage` | Built into every browser, persists across refreshes, requires zero setup. |
| Fonts | Google Fonts (Inter), loaded via `<link>` | One small external stylesheet, no JS dependency. |

No React, Vue, Next.js, npm packages, or build tooling were used. That's a
deliberate choice, not a limitation: this brief describes a small,
single-page, local-only tool, and a framework would add complexity
(a build step, a `node_modules` folder, bundler config) without adding
any capability this app needs. Being able to open `index.html` directly
and have it work is a feature here.

## Project structure

```
task-manager/
├── index.html   # Page structure and markup for every screen/modal
├── style.css    # All styling, theming, and responsive rules
├── script.js    # App state, rendering, and event handling
└── README.md    # This file
```

## Running it locally

No installation required. Either:

1. Double-click `index.html` to open it directly in a browser, **or**
2. From this folder, run a tiny local server (optional, but avoids some
   browsers' quirks with the `file://` protocol):
   ```bash
   python3 -m http.server 8000
   ```
   then open `http://localhost:8000` in your browser.

The app seeds itself with 3 example projects and 6 example tasks the
first time it runs in a browser. After that, whatever you add, edit, or
delete is saved automatically.

## Deploying it (GitHub + Vercel)

**1. Push to GitHub**
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/task-manager.git
git push -u origin main
```

**2. Deploy on Vercel**
1. Sign in to [vercel.com](https://vercel.com) with your GitHub account.
2. **Add New → Project**, then import the `task-manager` repository.
3. Vercel will detect this as a static site — no framework preset or
   build command is needed. Click **Deploy**.
4. You'll get a live URL ending in `.vercel.app`.

Every push to `main` redeploys automatically. Each visitor's data lives
only in their own browser, so everyone who opens the link starts from
the same seed data.

## Out of scope (intentionally)

Per the project brief: no login or authentication, no backend or
database, no payments, no multi-user support, no external API calls, and
no calendar/chat/enterprise project-management features.
