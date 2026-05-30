# Customer Connection Guide

This guide is for **workspace admins** connecting Meta and Google to your CRM.

## Before you start

- You need **admin** access in the CRM workspace
- Use a browser where you are logged into the accounts you want to connect
- Corporate Google/Microsoft policies may block third-party apps — contact IT if connect fails

---

## Connect Meta (Facebook & Instagram)

1. Go to **Settings → Integrations**
2. Click **Connect Meta**
3. Log in to Facebook if prompted
4. Approve the requested permissions
5. After redirect, confirm your **Pages** appear under Connected Pages
6. **Instagram Business** accounts linked to those Pages appear automatically

### If a Page is missing

- You must be an **Admin** of the Page in Meta Business Settings
- The Page must not be restricted by your organization

### If Instagram does not appear

- Link the Instagram Professional account to the Page in [Meta Business Suite](https://business.facebook.com/)
- Account must be **Business** or **Creator**, not personal

### “Needs reconnect”

1. Click **Disconnect**
2. Click **Connect Meta** again
3. Approve all permissions, especially any marked as missing

---

## Connect Google (Calendar & Meet)

1. Go to **Settings → Integrations**
2. Click **Connect Google**
3. Choose the Google account used for scheduling
4. Approve **offline access** when asked (required for background sync)
5. Confirm your email appears as the connected account

### Calendar & Meet

- Enabled by default for scheduling and video links
- Meet links are created through Google Calendar when your CRM books meetings

### Gmail

- **Not enabled by default** in most deployments
- If you need Gmail, your vendor must enable it after Google verification

### “Needs reconnect”

1. Click **Reconnect** (or Disconnect, then Connect)
2. Sign in again and approve **all** requested permissions
3. If using Google Workspace, ask IT to allow the CRM app under **Security → API controls**

---

## Disconnecting

Disconnecting removes the CRM’s access tokens for that provider in your workspace. It does not delete your Facebook Page or Google account.

---

## Privacy

- Access tokens stay on the vendor’s servers, encrypted
- The CRM web app never receives your provider access tokens
- Review your vendor’s privacy policy for data retention

---

## Support checklist

When contacting support, include:

- Workspace name
- Provider (Meta or Google)
- Screenshot of the Integrations page (missing permissions / error message)
- Time the error occurred (UTC)
