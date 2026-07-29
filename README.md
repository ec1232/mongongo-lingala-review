# Évaluation Lingala review app

Phone-first native-speaker review for the held-out Lingala TTS evaluation set.

## Reviewer experience

- French interface by default, with an English switch.
- One large Lingala sentence at a time.
- Three main answers: natural, rewrite, or unsure.
- Progress saves in the reviewer's browser.
- Each device/session remains separate.
- All 50 prototype phrases must be reviewed before submission.
- One final button sends the completed review privately to
  `contact@intellingo.app`.
- A download appears as a recovery option if automatic sending fails.

The app has no account system or analytics. The submission receiver accepts
only the fixed evaluation schema, stores a private backup with row-level
security, rate-limits requests, suppresses duplicate sends, and emails the
review as a JSON attachment to the fixed Intellingo destination.

## Private results

`/results` is a mobile-responsive dashboard for the private backup. It requires
the existing Supabase account for `contact@intellingo.app`; the browser keeps
the short-lived session only in session storage. A separate read-only Edge
Function re-validates the signed-in user, excludes labelled deployment tests,
and returns no IP or email-delivery metadata.

The dashboard shows the 40-of-50 prototype gate, the five-per-domain minimum,
speaker summaries, corrections, disagreements, and a combined JSON export.

## Data boundary

`public/evaluation.json` must remain byte-for-byte identical to
`../eval/lingala_eval_prototype.json`. The 50-line set is held out and
prohibited from training. `app/intents-fr.ts` contains reviewer-only French
reading aids; those paraphrases are not evaluation text.

## Commands

```bash
npm run dev
npm test
```

`npm run build` creates both the Sites worker build and a static deployment in
`dist/client/`.
