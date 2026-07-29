"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { INTENTS_FR } from "./intents-fr";

type Locale = "fr" | "en";
type ReviewStatus =
  | "approved_as_written"
  | "approved_with_correction"
  | "needs_discussion"
  | "rejected";

type EvalLine = {
  id: string;
  domain: string;
  difficulty: string;
  feature: string;
  text: string;
  intent_en: string;
};

type EvalSet = {
  schema_version: number;
  set_id: string;
  created_at: string;
  language: string;
  status: string;
  held_out: boolean;
  training_use: string;
  review_rule: string;
  lines: EvalLine[];
};

type Review = {
  status: ReviewStatus;
  corrected_text: string;
  note: string;
  updated_at: string;
};

type ReviewSession = {
  schema_version: 1;
  result_type: "lingala_native_text_review";
  set_id: string;
  reviewer: string;
  session_id: string;
  locale: Locale;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  submitted_at?: string | null;
  submission_id?: string | null;
  reviews: Record<string, Review>;
};

type Copy = {
  [key: string]: string;
};

const TARGET_APPROVALS = 150;
const ACTIVE_SESSION_KEY = "mongongo:active-session";
const SESSION_PREFIX = "mongongo:session:";
const LOCALE_KEY = "mongongo:locale";
const SUBMISSION_ENDPOINT =
  "https://giialrhkoqghytkizrgv.supabase.co/functions/v1/submit-lingala-review";

const COPY: Record<Locale, Copy> = {
  fr: {
    loading: "Préparation de l’évaluation…",
    loadError: "L’évaluation n’a pas pu être chargée. Réessayez plus tard.",
    language: "English",
    kicker: "Évaluation Lingala · Version 1",
    title: "Évaluation Lingala",
    intro:
      "Aidez-nous à vérifier que ces phrases sonnent naturelles en Lingala.",
    nameLabel: "Votre prénom et nom",
    namePlaceholder: "Par exemple, Marie Ilunga",
    start: "Commencer",
    resume: "Continuer mon évaluation",
    newReview: "Commencer pour une autre personne",
    resumeAs: "Évaluation de",
    reviewed: "phrases déjà vérifiées",
    howTitle: "C’est très simple",
    howOne: "Lisez une phrase en Lingala.",
    howTwo: "Dites si elle est naturelle ou corrigez-la.",
    howThree:
      "À la fin, touchez Envoyer : vos réponses arriveront automatiquement.",
    privacy:
      "En touchant Envoyer, votre nom et vos réponses seront transmis en privé à contact@intellingo.app et conservés comme copie de sécurité.",
    saved: "Enregistré automatiquement sur ce téléphone",
    progress: "Progression",
    approved: "naturelles ou corrigées",
    finish: "Terminer",
    sentence: "Phrase",
    of: "sur",
    meaning: "Sens prévu",
    meaningEnglish: "Sens en anglais",
    question: "Cette phrase sonne-t-elle naturelle en Lingala ?",
    natural: "Oui, elle est naturelle",
    different: "Je la dirais autrement",
    unsure: "Je ne suis pas sûr(e)",
    correctionTitle: "Écrivez la phrase comme vous la diriez naturellement",
    correctionHelp: "Gardez le même sens.",
    correctionPlaceholder: "Votre phrase naturelle en Lingala…",
    noteLabel: "Remarque (facultatif)",
    notePlaceholder: "Dialecte, mot ambigu, explication…",
    saveNext: "Enregistrer et continuer",
    cancel: "Annuler",
    previous: "Précédente",
    next: "Passer",
    more: "Autre choix",
    reject: "Cette phrase ne doit pas être utilisée",
    currentNatural: "Vous avez indiqué : naturelle",
    currentCorrected: "Vous avez proposé une correction",
    currentUnsure: "Vous avez indiqué : pas sûr(e)",
    currentRejected: "Vous avez indiqué : ne pas utiliser",
    change: "Modifier ma réponse",
    finishTitle: "Votre évaluation est prête à envoyer",
    finishEnough:
      "Merci — vous avez vérifié suffisamment de phrases pour cette étape.",
    finishPartial:
      "Vous pouvez envoyer ce résultat maintenant ou continuer plus tard. Chaque réponse nous aide.",
    sendInstruction:
      "Touchez une fois le bouton vert. Vos réponses seront envoyées directement et en privé à contact@intellingo.app.",
    submit: "Envoyer mes réponses",
    submitting: "Envoi en cours…",
    sentTitle: "Merci, c’est envoyé !",
    sent:
      "Vos réponses ont bien été envoyées à contact@intellingo.app. Vous n’avez rien d’autre à faire.",
    sendFailed:
      "L’envoi n’a pas fonctionné. Vos réponses sont toujours enregistrées sur ce téléphone. Réessayez.",
    retry: "Réessayer l’envoi",
    download: "Télécharger une copie de secours",
    needOne: "Vérifiez au moins une phrase avant d’envoyer.",
    continue: "Continuer à vérifier",
    downloaded:
      "La copie de secours a été téléchargée. Vos réponses restent aussi enregistrées sur ce téléphone.",
    anotherReviewer: "Commencer pour une autre personne",
    nameError: "Veuillez écrire votre nom avant de commencer.",
    correctionError: "Veuillez modifier la phrase avant de l’enregistrer.",
    progressSaved: "Vous pourrez revenir avec ce même lien sur ce téléphone.",
    heldOut: "Réservé à l’évaluation · jamais utilisé pour l’entraînement",
  },
  en: {
    loading: "Preparing the review…",
    loadError: "The review could not be loaded. Please try again later.",
    language: "Français",
    kicker: "Lingala evaluation · Version 1",
    title: "Lingala Evaluation",
    intro: "Help us check that these sentences sound natural in Lingala.",
    nameLabel: "Your full name",
    namePlaceholder: "For example, Marie Ilunga",
    start: "Start",
    resume: "Continue my review",
    newReview: "Start for a different person",
    resumeAs: "Review by",
    reviewed: "sentences already checked",
    howTitle: "It is very simple",
    howOne: "Read one sentence in Lingala.",
    howTwo: "Say if it is natural, or correct it.",
    howThree:
      "At the end, tap Submit: your answers will arrive automatically.",
    privacy:
      "When you tap Submit, your name and answers will be sent privately to contact@intellingo.app and retained as a safety copy.",
    saved: "Saved automatically on this phone",
    progress: "Progress",
    approved: "natural or corrected",
    finish: "Finish",
    sentence: "Sentence",
    of: "of",
    meaning: "Intended meaning",
    meaningEnglish: "Meaning in English",
    question: "Does this sentence sound natural in Lingala?",
    natural: "Yes, it sounds natural",
    different: "I would say it differently",
    unsure: "I’m not sure",
    correctionTitle: "Write the sentence as you would say it naturally",
    correctionHelp: "Keep the same meaning.",
    correctionPlaceholder: "Your natural Lingala sentence…",
    noteLabel: "Note (optional)",
    notePlaceholder: "Dialect, unclear word, explanation…",
    saveNext: "Save and continue",
    cancel: "Cancel",
    previous: "Previous",
    next: "Skip",
    more: "Another choice",
    reject: "This sentence should not be used",
    currentNatural: "You marked this as natural",
    currentCorrected: "You suggested a correction",
    currentUnsure: "You marked this as unsure",
    currentRejected: "You marked this as do not use",
    change: "Change my answer",
    finishTitle: "Your review is ready to submit",
    finishEnough:
      "Thank you — you checked enough sentences for this stage.",
    finishPartial:
      "You can send this result now or continue later. Every answer helps.",
    sendInstruction:
      "Tap the green button once. Your answers will be sent directly and privately to contact@intellingo.app.",
    submit: "Submit my answers",
    submitting: "Submitting…",
    sentTitle: "Thank you — sent!",
    sent:
      "Your answers were sent to contact@intellingo.app. You do not need to do anything else.",
    sendFailed:
      "Sending did not work. Your answers are still saved on this phone. Please try again.",
    retry: "Try sending again",
    download: "Download a backup copy",
    needOne: "Please review at least one sentence before submitting.",
    continue: "Keep reviewing",
    downloaded:
      "The backup copy was downloaded. Your answers also remain saved on this phone.",
    anotherReviewer: "Start for another person",
    nameError: "Please enter your name before starting.",
    correctionError: "Please change the sentence before saving it.",
    progressSaved: "You can return with this same link on this phone.",
    heldOut: "Evaluation only · never used for training",
  },
};

function newUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function newSession(setId: string, reviewer: string, locale: Locale): ReviewSession {
  const now = new Date().toISOString();
  return {
    schema_version: 1,
    result_type: "lingala_native_text_review",
    set_id: setId,
    reviewer: reviewer.trim(),
    session_id: newUuid(),
    locale,
    started_at: now,
    updated_at: now,
    completed_at: null,
    reviews: {},
  };
}

function safeStoredSession(setId: string): ReviewSession | null {
  try {
    const activeId = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!activeId) return null;
    const stored = localStorage.getItem(`${SESSION_PREFIX}${activeId}`);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as ReviewSession;
    return parsed.set_id === setId ? parsed : null;
  } catch {
    return null;
  }
}

function countReviews(session: ReviewSession | null) {
  const reviews = Object.values(session?.reviews ?? {});
  return {
    reviewed: reviews.length,
    approved: reviews.filter((review) =>
      review.status.startsWith("approved"),
    ).length,
  };
}

function makeResult(dataset: EvalSet, session: ReviewSession) {
  const stats = countReviews(session);
  return {
    ...session,
    completed_at: session.completed_at ?? new Date().toISOString(),
    summary: {
      total_lines: dataset.lines.length,
      reviewed_lines: stats.reviewed,
      approved_lines: stats.approved,
      target_approvals: TARGET_APPROVALS,
    },
    source: {
      app: "Évaluation Lingala native-speaker review",
      eval_schema_version: dataset.schema_version,
      eval_created_at: dataset.created_at,
      held_out: dataset.held_out,
      training_use: dataset.training_use,
    },
  };
}

function slugName(name: string) {
  return (
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "reviewer"
  );
}

function resultFile(dataset: EvalSet, session: ReviewSession) {
  const content = JSON.stringify(makeResult(dataset, session), null, 2);
  const date = new Date().toISOString().slice(0, 10);
  return new File([content], `lingala-review-${slugName(session.reviewer)}-${date}.json`, {
    type: "application/json",
  });
}

export default function Home() {
  const [dataset, setDataset] = useState<EvalSet | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [locale, setLocale] = useState<Locale>("fr");
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [started, setStarted] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [correction, setCorrection] = useState("");
  const [note, setNote] = useState("");
  const [correctionError, setCorrectionError] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const correctionRef = useRef<HTMLTextAreaElement>(null);

  const t = COPY[locale];
  const currentLine = dataset?.lines[index] ?? null;
  const currentReview = currentLine
    ? session?.reviews[currentLine.id]
    : undefined;
  const stats = useMemo(() => countReviews(session), [session]);

  useEffect(() => {
    const storedLocale = localStorage.getItem(LOCALE_KEY);
    const preferredLocale =
      storedLocale === "en" || storedLocale === "fr"
        ? storedLocale
        : navigator.language.toLowerCase().startsWith("fr")
          ? "fr"
          : "en";
    const frame = window.requestAnimationFrame(() =>
      setLocale(preferredLocale),
    );
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    fetch("/evaluation.json")
      .then((response) => {
        if (!response.ok) throw new Error("Evaluation not found");
        return response.json() as Promise<EvalSet>;
      })
      .then((loaded) => {
        setDataset(loaded);
        const stored = safeStoredSession(loaded.set_id);
        if (stored) {
          setSession(stored);
          setName(stored.reviewer);
          setSubmitted(Boolean(stored.submitted_at));
          const firstUnreviewed = loaded.lines.findIndex(
            (line) => !stored.reviews[line.id],
          );
          setIndex(firstUnreviewed === -1 ? 0 : firstUnreviewed);
        }
      })
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    if (!session) return;
    localStorage.setItem(ACTIVE_SESSION_KEY, session.session_id);
    localStorage.setItem(
      `${SESSION_PREFIX}${session.session_id}`,
      JSON.stringify(session),
    );
  }, [session]);

  function toggleLocale() {
    const next = locale === "fr" ? "en" : "fr";
    setLocale(next);
    localStorage.setItem(LOCALE_KEY, next);
    setSession((current) =>
      current
        ? { ...current, locale: next, updated_at: new Date().toISOString() }
        : current,
    );
  }

  function startReview(event?: FormEvent) {
    event?.preventDefault();
    if (!dataset) return;
    if (name.trim().length < 2) {
      setNameError(true);
      return;
    }
    const created = newSession(dataset.set_id, name, locale);
    setSession(created);
    setIndex(0);
    setStarted(true);
    setNameError(false);
    setSubmitted(false);
    setShareMessage("");
  }

  function resumeReview() {
    if (!session || !dataset) return;
    const firstUnreviewed = dataset.lines.findIndex(
      (line) => !session.reviews[line.id],
    );
    setIndex(firstUnreviewed === -1 ? 0 : firstUnreviewed);
    setStarted(true);
    setSubmitted(Boolean(session.submitted_at));
    if (session.submitted_at) setShowFinish(true);
  }

  function startDifferentReview() {
    setSession(null);
    setName("");
    setIndex(0);
    setStarted(false);
    setSubmitted(false);
    setShowFinish(false);
    setShareMessage("");
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  }

  function saveReview(
    status: ReviewStatus,
    correctedText = "",
    reviewNote = "",
  ) {
    if (!session || !currentLine) return;
    const now = new Date().toISOString();
    setSession({
      ...session,
      updated_at: now,
      reviews: {
        ...session.reviews,
        [currentLine.id]: {
          status,
          corrected_text: correctedText.trim(),
          note: reviewNote.trim(),
          updated_at: now,
        },
      },
    });
  }

  function advance() {
    if (!dataset) return;
    if (index >= dataset.lines.length - 1) {
      setShowFinish(true);
      return;
    }
    setEditing(false);
    setShowMore(false);
    setCorrectionError(false);
    setNote("");
    setIndex((current) => current + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function chooseQuick(status: "approved_as_written" | "needs_discussion") {
    saveReview(status);
    window.setTimeout(advance, 220);
  }

  function openCorrection() {
    if (!currentLine) return;
    setCorrection(currentReview?.corrected_text || currentLine.text);
    setNote(currentReview?.note || "");
    setEditing(true);
    setCorrectionError(false);
    window.setTimeout(() => {
      correctionRef.current?.focus();
      correctionRef.current?.setSelectionRange(
        correctionRef.current.value.length,
        correctionRef.current.value.length,
      );
    }, 50);
  }

  function submitCorrection(event: FormEvent) {
    event.preventDefault();
    if (!currentLine || correction.trim() === currentLine.text.trim()) {
      setCorrectionError(true);
      return;
    }
    saveReview("approved_with_correction", correction, note);
    setEditing(false);
    window.setTimeout(advance, 180);
  }

  function rejectLine() {
    saveReview("rejected", "", note);
    setShowMore(false);
    window.setTimeout(advance, 220);
  }

  function goTo(nextIndex: number) {
    if (!dataset) return;
    setEditing(false);
    setShowMore(false);
    setCorrectionError(false);
    setNote("");
    setIndex(Math.max(0, Math.min(dataset.lines.length - 1, nextIndex)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function downloadResult() {
    if (!dataset || !session) return;
    const file = resultFile(dataset, session);
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setShareMessage(t.downloaded);
  }

  async function submitResult() {
    if (!dataset || !session || stats.reviewed < 1 || submitting) return;
    setSubmitting(true);
    setShareMessage("");
    const result = makeResult(dataset, session);
    try {
      const response = await fetch(SUBMISSION_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      const responseBody = (await response.json()) as {
        ok?: boolean;
        submission_id?: string;
      };
      if (!response.ok || !responseBody.ok || !responseBody.submission_id) {
        throw new Error("submission_failed");
      }

      const sentAt = new Date().toISOString();
      setSession({
        ...session,
        completed_at: result.completed_at,
        updated_at: sentAt,
        submitted_at: sentAt,
        submission_id: responseBody.submission_id,
      });
      setSubmitted(true);
      setShareMessage("");
    } catch {
      setShareMessage(t.sendFailed);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <main className="center-shell">
        <p className="error-card">{t.loadError}</p>
      </main>
    );
  }

  if (!dataset) {
    return (
      <main className="center-shell loading-shell" aria-live="polite">
        <span className="loading-mark" aria-hidden="true">
          ✓
        </span>
        <p>{t.loading}</p>
      </main>
    );
  }

  if (!started) {
    return (
      <main className="welcome-shell">
        <button className="language-button" onClick={toggleLocale} type="button">
          {t.language}
        </button>

        <section className="welcome-card">
          <div className="welcome-brand">
            <p className="kicker">{t.kicker}</p>
            <h1>{t.title}<span aria-hidden="true">.</span></h1>
            <p className="welcome-intro">{t.intro}</p>
          </div>

          {session ? (
            <div className="resume-panel">
              <p className="resume-label">{t.resumeAs}</p>
              <h2>{session.reviewer}</h2>
              <p>
                <strong>{stats.reviewed}</strong> {t.reviewed}
              </p>
              <button className="primary-button" onClick={resumeReview} type="button">
                {t.resume}
                <span aria-hidden="true">→</span>
              </button>
              <button
                className="text-button"
                onClick={startDifferentReview}
                type="button"
              >
                {t.newReview}
              </button>
            </div>
          ) : (
            <form className="start-form" onSubmit={startReview}>
              <label htmlFor="reviewer-name">{t.nameLabel}</label>
              <input
                id="reviewer-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setNameError(false);
                }}
                placeholder={t.namePlaceholder}
                autoComplete="name"
              />
              {nameError && (
                <p className="field-error" role="alert">
                  {t.nameError}
                </p>
              )}
              <button className="primary-button" type="submit">
                {t.start}
                <span aria-hidden="true">→</span>
              </button>
            </form>
          )}

          <div className="how-panel">
            <h2>{t.howTitle}</h2>
            <ol>
              <li><span>1</span>{t.howOne}</li>
              <li><span>2</span>{t.howTwo}</li>
              <li><span>3</span>{t.howThree}</li>
            </ol>
          </div>

          <p className="privacy-note">
            <span aria-hidden="true">✓</span>
            {t.privacy}
          </p>
        </section>
      </main>
    );
  }

  if (!session || !currentLine) return null;

  const progress = Math.round((stats.reviewed / dataset.lines.length) * 100);
  const currentStatusCopy = currentReview
    ? {
        approved_as_written: t.currentNatural,
        approved_with_correction: t.currentCorrected,
        needs_discussion: t.currentUnsure,
        rejected: t.currentRejected,
      }[currentReview.status]
    : null;

  return (
    <main className="review-shell">
      <header className="review-header">
        <div>
          <p className="mini-brand">Évaluation Lingala<span>.</span></p>
          <p className="reviewer-name">{session.reviewer}</p>
        </div>
        <div className="header-actions">
          <button className="language-button compact" onClick={toggleLocale} type="button">
            {t.language}
          </button>
          <button
            className="finish-button"
            onClick={() => setShowFinish(true)}
            type="button"
          >
            {t.finish}
          </button>
        </div>
      </header>

      <section className="progress-section" aria-label={t.progress}>
        <div className="progress-labels">
          <span>{t.progress}</span>
          <strong>{stats.reviewed} / {dataset.lines.length}</strong>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={dataset.lines.length}
          aria-valuenow={stats.reviewed}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <p>
          <span className="save-dot" aria-hidden="true" />
          {t.saved}
        </p>
      </section>

      <article className="sentence-card">
        <div className="sentence-position">
          <span>{t.sentence} {index + 1} {t.of} {dataset.lines.length}</span>
          <span className="line-id">{currentLine.id}</span>
        </div>

        <p className="lingala-text" lang="ln">
          {currentLine.text}
        </p>

        <details className="meaning-box">
          <summary>{t.meaning}</summary>
          <p>
            {locale === "fr"
              ? INTENTS_FR[currentLine.id] || currentLine.intent_en
              : currentLine.intent_en}
          </p>
          {locale === "fr" && (
            <small>{t.meaningEnglish}: {currentLine.intent_en}</small>
          )}
        </details>

        {editing ? (
          <form className="correction-form" onSubmit={submitCorrection}>
            <div>
              <h2>{t.correctionTitle}</h2>
              <p>{t.correctionHelp}</p>
            </div>
            <textarea
              ref={correctionRef}
              value={correction}
              onChange={(event) => {
                setCorrection(event.target.value);
                setCorrectionError(false);
              }}
              lang="ln"
              spellCheck={false}
              rows={5}
              placeholder={t.correctionPlaceholder}
            />
            {correctionError && (
              <p className="field-error" role="alert">
                {t.correctionError}
              </p>
            )}
            <label>
              <span>{t.noteLabel}</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                placeholder={t.notePlaceholder}
              />
            </label>
            <div className="form-actions">
              <button className="primary-button" type="submit">
                {t.saveNext}
                <span aria-hidden="true">→</span>
              </button>
              <button
                className="text-button"
                onClick={() => setEditing(false)}
                type="button"
              >
                {t.cancel}
              </button>
            </div>
          </form>
        ) : (
          <section className="decision-section">
            <h2>{t.question}</h2>

            {currentStatusCopy && (
              <div className={`current-answer status-${currentReview?.status}`}>
                <span aria-hidden="true">✓</span>
                <p>{currentStatusCopy}</p>
              </div>
            )}

            <div className="decision-buttons">
              <button
                className={`answer-button natural ${
                  currentReview?.status === "approved_as_written" ? "selected" : ""
                }`}
                onClick={() => chooseQuick("approved_as_written")}
                type="button"
              >
                <span className="answer-icon" aria-hidden="true">✓</span>
                <span>{t.natural}</span>
              </button>
              <button
                className={`answer-button different ${
                  currentReview?.status === "approved_with_correction" ? "selected" : ""
                }`}
                onClick={openCorrection}
                type="button"
              >
                <span className="answer-icon" aria-hidden="true">✎</span>
                <span>{t.different}</span>
              </button>
              <button
                className={`answer-button unsure ${
                  currentReview?.status === "needs_discussion" ? "selected" : ""
                }`}
                onClick={() => chooseQuick("needs_discussion")}
                type="button"
              >
                <span className="answer-icon" aria-hidden="true">?</span>
                <span>{t.unsure}</span>
              </button>
            </div>

            <button
              className="more-button"
              onClick={() => {
                const next = !showMore;
                setShowMore(next);
                if (next) setNote(currentReview?.note || "");
              }}
              aria-expanded={showMore}
              type="button"
            >
              {t.more} <span aria-hidden="true">{showMore ? "−" : "+"}</span>
            </button>

            {showMore && (
              <div className="more-panel">
                <label>
                  <span>{t.noteLabel}</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={2}
                    placeholder={t.notePlaceholder}
                  />
                </label>
                <button className="reject-button" onClick={rejectLine} type="button">
                  {t.reject}
                </button>
              </div>
            )}
          </section>
        )}
      </article>

      <nav className="sentence-nav" aria-label="Sentence navigation">
        <button
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          type="button"
        >
          <span aria-hidden="true">←</span> {t.previous}
        </button>
        <button
          onClick={() => goTo(index + 1)}
          disabled={index === dataset.lines.length - 1}
          type="button"
        >
          {t.next} <span aria-hidden="true">→</span>
        </button>
      </nav>

      <footer className="review-footer">
        <p>{t.progressSaved}</p>
        <p>{t.heldOut}</p>
      </footer>

      {showFinish && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (!submitted && event.target === event.currentTarget) {
              setShowFinish(false);
            }
          }}
        >
          <section
            className="finish-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finish-title"
          >
            {!submitted && (
              <button
                className="close-button"
                onClick={() => setShowFinish(false)}
                aria-label={t.cancel}
                type="button"
              >
                ×
              </button>
            )}
            <span className="finish-mark" aria-hidden="true">✓</span>
            <p className="kicker">{session.reviewer}</p>
            <h2 id="finish-title">
              {submitted ? t.sentTitle : t.finishTitle}
            </h2>
            <div className="finish-stats">
              <strong>{stats.reviewed}</strong>
              <span>{t.reviewed}</span>
              <strong>{stats.approved}</strong>
              <span>{t.approved}</span>
            </div>
            {submitted ? (
              <>
                <p className="sent-confirmation" aria-live="polite">
                  {t.sent}
                </p>
                <button
                  className="text-button"
                  onClick={startDifferentReview}
                  type="button"
                >
                  {t.anotherReviewer}
                </button>
              </>
            ) : (
              <>
                <p className="finish-summary">
                  {stats.approved >= TARGET_APPROVALS
                    ? t.finishEnough
                    : t.finishPartial}
                </p>
                <p className="send-instruction">{t.sendInstruction}</p>
                <button
                  className="primary-button share-button"
                  onClick={submitResult}
                  disabled={stats.reviewed < 1 || submitting}
                  type="button"
                >
                  <span aria-hidden="true">{submitting ? "…" : "→"}</span>
                  {submitting ? t.submitting : shareMessage ? t.retry : t.submit}
                </button>
                {stats.reviewed < 1 && (
                  <p className="share-message">{t.needOne}</p>
                )}
                {shareMessage && (
                  <>
                    <p className="share-message error-message" aria-live="polite">
                      {shareMessage}
                    </p>
                    <button
                      className="download-button"
                      onClick={downloadResult}
                      type="button"
                    >
                      {t.download}
                    </button>
                  </>
                )}
                <button
                  className="text-button"
                  onClick={() => setShowFinish(false)}
                  type="button"
                >
                  {t.continue}
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
