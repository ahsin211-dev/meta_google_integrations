# Customer Connection Guide

This guide is for **workspace administrators** connecting Meta and Google to your CRM.

## Before you start

- You need **admin** access to the workspace.
- Use the account that owns the Facebook Pages or Google Calendar you want to sync.
- Corporate Google accounts may require IT approval for third-party app access.

---

## Connect Meta (Facebook & Instagram)

1. Go to **Settings → Integrations → Meta**.
2. Click **Connect**.
3. Log in to Facebook and approve the requested permissions.
4. After redirect, you should see:
   - Connected Facebook **Pages**
   - Linked **Instagram Business** accounts (when a Page has one)
5. If you see **Needs reconnect**, click **Reconnect** and approve all permissions again.

### Tips

- The Facebook user must be an **admin** of the Pages you need.
- If a Page is missing, check Page roles in Facebook Business Settings.
- Instagram accounts must be **Business** or **Creator** and linked to the Page.

---

## Connect Google (Calendar & Meet)

1. Go to **Settings → Integrations → Google**.
2. Click **Connect** and choose your Google account.
3. Review scopes on the consent screen and allow access.
4. Enabled modules appear in the integration panel:
   - **Calendar** — events sync
   - **Meet** — video conference links on events
   - **Gmail** — only if your organization has enabled it

### Tips

- If status shows **Needs reconnect**, your organization may require re-approval or the refresh token was not issued—click **Reconnect**.
- Meet links are created when your CRM schedules meetings on your primary calendar.

---

## Disconnecting

1. Open the integration settings page.
2. Click **Disconnect**.
3. Tokens are removed from the CRM; you may also remove the app in Facebook/Google account settings.

---

## Privacy

- Access tokens stay on secure servers and are **never** shown in the browser.
- Only integration **status**, account names, and granted scopes are visible in settings.

---

## Getting help

Provide support with:

- Workspace name
- Provider (Meta or Google)
- Error message shown in settings
- Screenshot of missing permissions list

Support cannot access your Facebook or Google password.
