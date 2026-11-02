# Super Namecard

Interactive 3D digital business cards as a service, at https://1name.cards/.

- `cards/` — the app: card styles, editor, account and checkout (static files, served by the backend)
- `deploy/` — backend on the VPS: PocketBase hooks and migrations, tunnel, sync and Paddle setup scripts
- `render/` — export worker that renders the MP4 / GIF / JPG share packs

Jed's personal card (card.jedliuai.com) lives on `main` only; this branch does not carry it.
