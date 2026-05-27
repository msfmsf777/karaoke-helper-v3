# Analytics Production Setup

KHelper product analytics is opt-in only. The renderer can present consent without an analytics endpoint configured; in that state the sender remains a no-op.

## Configuration

For a production signed release, add the public TelemetryDeck application ingestion ID to the local untracked `.env.release.local` file:

```dotenv
VITE_TELEMETRYDECK_APP_ID=REPLACE_WITH_PRODUCTION_APPLICATION_ID
VITE_TELEMETRYDECK_TEST_MODE=0
```

For QA, use a separate TelemetryDeck application ID and set `VITE_TELEMETRYDECK_TEST_MODE=1`. `npm run build:test` does not load `.env.release.local`; set those variables explicitly only when building an analytics-enabled QA package.

Do not store TelemetryDeck account credentials, dashboard tokens, Azure secrets, or a production app ID in tracked files.

## Production Gate

Before putting `VITE_TELEMETRYDECK_APP_ID` into a release build:

1. Configure and document the enforced TelemetryDeck retention duration in [PRIVACY.md](../PRIVACY.md).
2. Build an analytics-enabled QA package using the separate test application.
3. Opt in, exercise each allowlisted feature event, and inspect the received fields.
4. Confirm that only the fields disclosed in `PRIVACY.md` and TelemetryDeck's documented SDK metadata are received.
5. Confirm that refusal and opt-out send no subsequent events and that opting out removes `%APPDATA%\khelper-live\telemetry-client.json`.
6. Protect dashboard access with MFA and restrict it to the maintainer account.

If unexpected payload fields appear, update the notice before production or replace the SDK submission path with a narrower reviewed implementation.

## Intended Dashboard Views

- Active installations by app version and interface language.
- Stream Mode and OBS-link feature adoption.
- Search, download, and separation result categories.
- Lyrics-action categories.
- Update and settings-recovery reliability.
- Beta release comparisons.
