# Google Login Setup Guide

This guide walks you through obtaining a **Client ID** and **Client Secret** from Google Cloud Console to enable Google social sign-in in AI Collective.

---

## Table of Contents

1. [Create a Google Cloud Project](#1-create-a-google-cloud-project)
2. [Enable the Google OAuth API](#2-enable-the-google-oauth-api)
3. [Configure the OAuth Consent Screen](#3-configure-the-oauth-consent-screen)
4. [Create an OAuth 2.0 Client ID](#4-create-an-oauth-20-client-id)
5. [Configure the .env File](#5-configure-the-env-file)
6. [Verify the Integration](#6-verify-the-integration)
7. [Security Checklist](#7-security-checklist)
8. [Common Errors](#8-common-errors)

---

## 1. Create a Google Cloud Project

> Skip this step if you already have a project.

1. Go to **[Google Cloud Console](https://console.cloud.google.com)**
2. Click the project dropdown in the top-left corner → **"New Project"**
3. Fill in the details:
   - **Project name**: `ai-collective` (or any name you prefer)
   - **Organization**: leave as default for personal use
4. Click **"Create"** and wait for the project to be provisioned
5. Make sure the new project is selected in the dropdown

---

## 2. Enable the Google OAuth API

1. In the left sidebar go to **APIs & Services → Library**
2. Search for `Google People API`
3. Click it and press **"Enable"**

> The People API provides the `/userinfo` endpoint used to fetch the user's name, email, and profile picture after sign-in.

---

## 3. Configure the OAuth Consent Screen

This is the screen users see when granting your app permission to access their Google account.

1. Go to **APIs & Services → OAuth consent screen**
2. Select user type:
   - **External** — allows any Google account (recommended for development and production)
   - **Internal** — restricted to your Google Workspace organization only
3. Click **"Create"**
4. Fill in the required fields:

   | Field | Example value |
   |-------|--------------|
   | App name | AI Collective |
   | User support email | you@example.com |
   | Developer contact email | you@example.com |

5. Click **"Save and Continue"**

### Add Scopes

6. On the **Scopes** step click **"Add or Remove Scopes"**
7. Search for and select the following scopes:

   | Scope | Purpose |
   |-------|---------|
   | `.../auth/userinfo.email` | Read the user's email address |
   | `.../auth/userinfo.profile` | Read the user's name and profile picture |
   | `openid` | Verify the user's identity |

8. Click **"Update"** → **"Save and Continue"**

### Test Users (only needed while App Status is "Testing")

9. Click **"Add Users"** and add the Google email addresses that need to sign in during testing
10. Click **"Save and Continue"** → **"Back to Dashboard"**

> **Note**: While the app is in **Testing** status, only email addresses on the test user list can sign in. To open access to everyone, click **"Publish App"** — no Google review is required for apps that only request basic identity scopes.

---

## 4. Create an OAuth 2.0 Client ID

1. Go to **APIs & Services → Credentials**
2. Click **"+ Create Credentials"** → **"OAuth client ID"**
3. Set **Application type** to **"Web application"**
4. Set a name: `AI Collective Web`
5. Under **Authorized redirect URIs** add the following — this step is critical:

   **Development:**
   ```
   http://127.0.0.1:8000/api/v1/auth/google/callback
   http://localhost:8000/api/v1/auth/google/callback
   ```

   **Production** (replace `yourdomain.com` with your actual domain):
   ```
   https://yourdomain.com/api/v1/auth/google/callback
   ```

   > This URI must match **exactly** with `GOOGLE_LOGIN_REDIRECT_URI` in your `.env` file. A single character mismatch will cause a `redirect_uri_mismatch` error.

6. Click **"Create"**

### Copy Your Credentials

After creation Google shows a popup with:

```
Your Client ID:     123456789-abcdefghijklmnop.apps.googleusercontent.com
Your Client Secret: GOCSPX-xxxxxxxxxxxxxxxxxxxxxx
```

**Copy both values** — you will need them in the next step.

You can also click **"Download JSON"** to save a backup of the credentials file.

---

## 5. Configure the .env File

Open the `.env` file at the project root and add the following variables:

```env
# ── Google Login (Social Sign-In) ──────────────────────────────────────────

# Client ID from Google Cloud Console
GOOGLE_LOGIN_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com

# Client Secret from Google Cloud Console
GOOGLE_LOGIN_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx

# Must match exactly the URI registered in Google Cloud Console
GOOGLE_LOGIN_REDIRECT_URI=http://127.0.0.1:8000/api/v1/auth/google/callback

# Frontend URL — where the backend redirects the browser after a successful login
FRONTEND_URL=http://localhost:8080
```

### Full auth section example

```env
# JWT
JWT_SECRET_KEY=your-super-secret-key-change-in-production
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Google Login
GOOGLE_LOGIN_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_LOGIN_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_LOGIN_REDIRECT_URI=http://127.0.0.1:8000/api/v1/auth/google/callback
FRONTEND_URL=http://localhost:8080
```

---

## 6. Verify the Integration

### Start the backend

```bash
uv run uvicorn server.api.main:app --reload --port 8000
```

### Test the login URL endpoint

```bash
curl http://127.0.0.1:8000/api/v1/auth/google/login
```

Expected response:

```json
{
  "authorize_url": "https://accounts.google.com/o/oauth2/auth?...",
  "state": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

### Test in the browser

1. Open the `authorize_url` in a browser
2. Select a Google account and grant permission
3. The browser redirects to `http://localhost:8080/auth/callback?token=<JWT>`

### Frontend callback handler

The `/auth/callback` route is already wired up (`ui/src/pages/AuthCallback.tsx`,
registered in `ui/src/App.tsx`) — nothing to add here. It reads `token`/`error`
from the query string, calls `useAuth().loginWithToken(token)`
(`ui/src/contexts/AuthContext.tsx`) to store the session, and redirects to
`/dashboard` on success or `/login?error=...` on failure.

---

## 7. Security Checklist

| Action | Reason |
|--------|--------|
| Add `.env` to `.gitignore` | The Client Secret must never be committed to version control |
| Use a randomly generated `JWT_SECRET_KEY` in production | The default key in settings is not secure |
| Only register URIs you actually use | Prevents open redirect vulnerabilities |
| Use HTTPS for all redirect URIs in production | Google requires HTTPS for non-localhost URIs |
| Rotate the Client Secret periodically | Limits the blast radius if the secret is ever exposed |

### Generate a secure JWT_SECRET_KEY

```bash
# Linux / macOS
openssl rand -hex 32

# Using uv / Python
uv run python -c "import secrets; print(secrets.token_hex(32))"
```

### Verify .gitignore covers .env

```bash
grep "\.env" .gitignore || echo ".env" >> .gitignore
```

---

## 8. Common Errors

### `redirect_uri_mismatch`

The redirect URI sent in the request does not match any URI registered in Google Cloud Console.

**Fix**: Compare `GOOGLE_LOGIN_REDIRECT_URI` in your `.env` with the **Authorized redirect URIs** list in the Console. They must be character-for-character identical, including `http` vs `https`, port numbers, and trailing slashes.

---

### `access_blocked: This app's request is invalid`

The app is in Testing status and the user's email has not been added to the test user list.

**Fix**: Go to **OAuth consent screen → Test users**, add the email address, or click **Publish App** to remove the restriction entirely.

---

### `Google Login is not configured` (HTTP 503)

`GOOGLE_LOGIN_CLIENT_ID` or `GOOGLE_LOGIN_CLIENT_SECRET` is missing from `.env`.

**Fix**: Add both variables to `.env` and restart the backend server.

---

### `Failed to fetch Google user info` (HTTP 502)

The backend cannot reach `googleapis.com`.

**Fix**: Check the server's network connectivity, firewall rules, or any outbound proxy configuration.
