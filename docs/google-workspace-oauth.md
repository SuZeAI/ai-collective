# Google Workspace OAuth Setup Guide

This guide walks you through obtaining a Google OAuth client to enable the **Drive, Sheets,
Docs, Slides, and Calendar** skills in AI Collective. This is a separate OAuth client from
[Google Login](google-login-setup.md) ("Sign in with Google") — one authenticates a user into
AI Collective, the other lets a staff member's skill act on a Google account's Drive/Sheets/etc.

---

## Table of Contents

1. [Create a Google Cloud Project](#1-create-a-google-cloud-project)
2. [Enable the Workspace APIs](#2-enable-the-workspace-apis)
3. [Create an OAuth 2.0 Client ID](#3-create-an-oauth-20-client-id)
4. [Point the Backend at Your Credentials](#4-point-the-backend-at-your-credentials)
5. [Connect an Account from the Skills UI](#5-connect-an-account-from-the-skills-ui)
6. [Common Errors](#6-common-errors)

---

## 1. Create a Google Cloud Project

> Skip this step if you already have a project (it can be the same one used for Google Login).

1. Go to **[Google Cloud Console](https://console.cloud.google.com)**
2. Click the project dropdown → **"New Project"**, name it, and create it
3. Make sure the new project is selected in the dropdown

---

## 2. Enable the Workspace APIs

Under **APIs & Services → Library**, enable the APIs for whichever skills you plan to use:

| Skill | API to enable |
|-------|----------------|
| `sheet` | Google Sheets API |
| `drive` | Google Drive API |
| `docs` | Google Docs API |
| `slides` | Google Slides API |
| `calendar` | Google Calendar API |

You only need to enable the ones matching the skills you'll actually attach to staff.

---

## 3. Create an OAuth 2.0 Client ID

1. Go to **APIs & Services → Credentials** → **"+ Create Credentials"** → **"OAuth client ID"**
2. Set **Application type** to **Web application**
3. Under **Authorized redirect URIs**, add the URI matching your deployment:

   | Deployment | Redirect URI |
   |------------|---------------|
   | No Docker (`make backend`) | `http://127.0.0.1:8000/api/v1/auth/oauth/callback` (the default) |
   | Docker, behind nginx (`make dev` / `make up`) | `http://localhost:2026/api/v1/auth/oauth/callback` |

   Using a different host/port? Set `GOOGLE_OAUTH_REDIRECT_URI` in `.env` to match exactly —
   a mismatch here causes a `redirect_uri_mismatch` error from Google.
4. Click **Create**, then **Download JSON** to save the client secret file.

---

## 4. Point the Backend at Your Credentials

| Deployment | Where to put the file | `.env` setting |
|------------|------------------------|-----------------|
| No Docker | Anywhere on disk | `GOOGLE_OAUTH_CLIENT_SECRET_PATH=/absolute/path/to/client_secret.json` |
| Docker | Under `.secrets/credentials/` at the repo root (already mounted into the backend container at `/app/.secrets/credentials/`) | `GOOGLE_OAUTH_CLIENT_SECRET_PATH=/app/.secrets/credentials/<your-file>.json` |

`.secrets/` is gitignored — the file never gets committed. Restart the backend after editing
`.env` so it picks up the new path.

---

## 5. Connect an Account from the Skills UI

Once the backend has a valid credentials path, connect a Google account from the Skills page for
any Drive/Sheets/Docs/Slides/Calendar skill. This calls `POST /api/v1/auth/oauth/start`, which
opens Google's consent screen for the scopes that skill needs; on success the token is stored
per-user under `.secrets/google/<owner>/<tool>/token_<email>.json` — never in `config.yml` and
never committed to git.

---

## 6. Common Errors

### `Google OAuth client credentials file not found` (HTTP 400)

`GOOGLE_OAUTH_CLIENT_SECRET_PATH` (or the legacy `CREDENTIALS_PATH`) doesn't point at a file the
backend container/process can actually read.

**Fix**: confirm the path exists *inside the container* (Docker mounts `.secrets/` at
`/app/.secrets/`, not the host path), then restart the backend.

### `redirect_uri_mismatch`

The redirect URI AI Collective sent doesn't match any URI registered on the OAuth client in
Google Cloud Console.

**Fix**: compare `GOOGLE_OAUTH_REDIRECT_URI` (or the default in step 3) against the Console's
**Authorized redirect URIs** list — they must be character-for-character identical.

### Missing dependency `google-auth-oauthlib` (HTTP 500)

The Google auth extras weren't installed.

**Fix**: `uv sync --all-extras` (already the default for `make install`/the backend Dockerfile).
