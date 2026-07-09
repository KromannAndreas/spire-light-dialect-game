# Spire Light Dialect Game

A mobile-first Danish dialect game for Spirelight.ai's KU university event.

## The two games

- **Guess the dialect:** create or join a live room, hear an archival Danish dialect clip, pick among four dialects, and follow the group through eight timed rounds on your phone.
- **Guess a student's dialect:** record one of 50 Danish sentences, explicitly consent to event-only playback, self-report your dialect, then listen to consenting peers and compare guesses without a score.

The archival quiz contains 24 recordings and labels taken from the event content document in Google Drive. Wrong answers are deterministic alternatives drawn from the other represented dialects.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set these public client values in `.env.local` and in Vercel:

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

The Supabase schema is in `supabase/migrations`. It includes row-level security, explicit grants for the Data API, and an event-only public Storage bucket for consenting recordings.

## Event operations

- Test room creation, joining, playback, microphone permission, and upload on both iPhone Safari and Android Chrome before opening the stand.
- Keep the game open only for the event window.
- The consent copy commits Spirelight to deleting participant recordings no later than seven days after the event. Remove both the `student_clips` rows and the corresponding files in the `dialect-clips` Supabase Storage bucket. Participants may ask the stand team for earlier deletion.
- Do not collect a full name or other personal details in the recording.

## Checks

```bash
npm run lint
npm run build
```
