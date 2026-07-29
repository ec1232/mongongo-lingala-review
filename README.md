# Mongongo review app

Phone-first native-speaker review for the held-out Lingala TTS evaluation set.

## Reviewer experience

- French interface by default, with an English switch.
- One large Lingala sentence at a time.
- Three main answers: natural, rewrite, or unsure.
- Progress saves only in the reviewer's browser.
- Each device/session remains separate.
- Finish uses the phone share sheet when file sharing is supported.
- Download is always available as a fallback.

The app has no account system, analytics, database, or response-collection
backend. A reviewer must intentionally send the exported JSON file back through
WhatsApp, email, or another channel.

## Data boundary

`public/evaluation.json` must remain byte-for-byte identical to
`../eval/lingala_eval_draft.json`. The set is held out and prohibited from
training. `app/intents-fr.ts` contains reviewer-only French reading aids; those
paraphrases are not evaluation text.

## Commands

```bash
npm run dev
npm test
```

`npm run build` creates both the Sites worker build and a static deployment in
`dist/client/`.
