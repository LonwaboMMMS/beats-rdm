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
