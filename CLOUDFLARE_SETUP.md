# Cloudflare setup for private beat downloads

The download routes in this project use a private Cloudflare R2 bucket and the existing D1 user/session database. Do not make the R2 bucket public.

## 1. Configure Pages bindings

In Cloudflare Dashboard, open the Pages project for this site, then Settings → Functions → Bindings.

- Add a D1 database binding named `DB` and select the database already used for Reverb Beats authentication.
- Add an R2 bucket binding named `BEATS_BUCKET` and select the private bucket that will hold the audio files.
- Save and redeploy the Pages project so the Functions receive the bindings.

Do not add placeholder database IDs to wrangler.toml. The bindings can be configured in the Pages dashboard.

## 2. Apply the purchase/file migration

The users and sessions tables must already exist from the project's initial schema. Then apply:

```sh
npx wrangler d1 execute YOUR_DATABASE_NAME --remote --file=migrations/0003_purchases_and_private_audio.sql
```

Replace `YOUR_DATABASE_NAME` with the actual D1 database name.

## 3. Keep the audio objects private

Upload the downloadable MP3 and WAV masters to the R2 bucket. Store only the R2 object keys in D1's `beat_files` table; do not put public R2 URLs in the website.

Example records (replace the values with real IDs and object keys):

```sql
INSERT INTO beat_files (beat_id, format, object_key)
VALUES ('beat-001', 'mp3', 'masters/beat-001.mp3');
INSERT INTO beat_files (beat_id, format, object_key)
VALUES ('beat-001', 'wav', 'masters/beat-001.wav');
```

## 4. Grant download access only after payment

A purchase becomes downloadable only when a matching row exists in `beat_purchases` with `payment_status = 'paid'`. The checkout/payment integration must create or update this row only after verifying a successful payment with the payment provider.

Example test record (only use for a controlled test account after confirming the user ID):

```sql
INSERT INTO beat_purchases
(user_id, beat_id, beat_title, producer, licence, payment_status, purchased_at)
VALUES
(1, 'beat-001', 'Example Beat', 'Reverb Daily', 'MP3 Lease', 'paid', unixepoch() * 1000);
```

## 5. Routes

- `GET /api/account/purchases` returns the signed-in user's paid purchases.
- `GET /api/download/{beatId}/mp3` streams the MP3 only after checking the signed-in user's paid entitlement.
- `GET /api/download/{beatId}/wav` does the same for WAV.

The download endpoint streams the object from the private bucket through the Pages Function. It does not expose a permanent public R2 URL or a public bucket path.

## Important current limitation

This adds the secure delivery and account display layer. It does not yet upload files from the admin dashboard, create paid purchase records from PayFast, or configure Cloudflare bindings. Until those are connected, downloads will return a configuration or entitlement error rather than granting access. Never mark a purchase as paid manually in production; payment status must be verified server-side.

## 6. Configure the administrator account

The admin dashboard uses the same D1 users and sessions database as customer accounts. No second database or separate admin login is needed.

1. In Cloudflare Dashboard, open **Workers & Pages → your Pages project → Settings → Variables and Secrets**.
2. Add a production variable named `ADMIN_EMAIL` and set its value to the exact email address used by the administrator's Reverb Beats account. Do not put this email in public GitHub code.
3. Confirm the Pages project has the existing D1 database binding named `DB`.
4. Apply the administrator-role migration to the same D1 database:

```sh
npx wrangler d1 execute YOUR_DATABASE_NAME --remote --file=migrations/0004_add_admin_role.sql
```

5. Redeploy the Pages project after saving the variable.

When the account with that email signs in, the authentication endpoint grants it the administrator role in D1. The My Account page then displays **Open Admin Dashboard**. The `/admin.html` route is also protected server-side by Pages middleware; hiding the link alone is not the security control. Other accounts receive a forbidden response.

For a brand-new database, `schema.sql` already includes the `is_admin` column. In that case, do not run migration 0004 as well, because the column already exists. For an existing database created before this change, run migration 0004 once.

## 7. Progressive Web App (PWA)

The repository now includes a web app manifest, app icon, service worker, offline fallback page, and install prompt.

- The public storefront shell and core static assets are cached for offline launch.
- The service worker does not cache account pages, the admin page, or API responses.
- Sign-in, purchases, downloads, and other server-backed features still require an internet connection.
- The install prompt appears in supported browsers when the browser considers the site installable.

Cloudflare Pages must serve the site over HTTPS (the `pages.dev` domain already does). After deployment, open the site in Chrome on Android and use the browser's **Install app** or **Add to Home screen** option if the prompt is not shown automatically. On iPhone/iPad, use Safari's Share menu → **Add to Home Screen**.
