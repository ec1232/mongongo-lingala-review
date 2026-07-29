export const DOMAIN_ORDER = [
  "everyday",
  "education",
  "story",
  "customer_support",
  "public_health",
  "numbers_dates_currency",
  "names_addresses",
  "french_lingala_codeswitch",
];

export const DOMAIN_LABELS = {
  everyday: "Everyday speech",
  education: "Education",
  story: "Stories",
  customer_support: "Customer support",
  public_health: "Public health",
  numbers_dates_currency: "Numbers & dates",
  names_addresses: "Names & addresses",
  french_lingala_codeswitch: "French / Lingala",
};

const TARGET_ACCEPTED = 40;
const DOMAIN_MINIMUM = 5;

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function finalText(line, response) {
  return normalizeText(
    response.status === "approved_with_correction"
      ? response.corrected_text
      : line.text,
  );
}

export function aggregateReviewResults(evaluation, submissions) {
  const reviewers = submissions.map((submission) => {
    const responses = Object.values(submission.reviews ?? {});
    const count = (status) =>
      responses.filter((response) => response.status === status).length;

    return {
      id: submission.id,
      name: submission.reviewer,
      submitted_at: submission.submitted_at,
      reviewed: responses.length,
      approved_as_written: count("approved_as_written"),
      corrected: count("approved_with_correction"),
      unsure: count("needs_discussion"),
      rejected: count("rejected"),
    };
  });

  const lines = evaluation.lines.map((line) => {
    const responses = submissions
      .map((submission) => {
        const response = submission.reviews?.[line.id];
        return response
          ? {
              reviewer: submission.reviewer,
              status: response.status,
              corrected_text: normalizeText(response.corrected_text),
              note: normalizeText(response.note),
            }
          : null;
      })
      .filter(Boolean);

    if (!responses.length) {
      return {
        ...line,
        resolution: "unreviewed",
        final_text: null,
        responses: [],
        reasons: ["unreviewed"],
      };
    }

    const nonApprovals = responses.filter(
      (response) => !response.status.startsWith("approved"),
    );
    const proposedTexts = new Set(
      responses
        .filter((response) => response.status.startsWith("approved"))
        .map((response) => finalText(line, response)),
    );

    if (nonApprovals.length || proposedTexts.size !== 1) {
      return {
        ...line,
        resolution: "conflict",
        final_text: null,
        responses,
        reasons: [
          ...new Set([
            ...nonApprovals.map((response) => response.status),
            ...(proposedTexts.size > 1 ? ["different_approved_texts"] : []),
          ]),
        ],
      };
    }

    const acceptedText = [...proposedTexts][0];
    return {
      ...line,
      resolution: "accepted",
      final_text: acceptedText,
      changed: acceptedText !== normalizeText(line.text),
      responses,
      reasons: [],
    };
  });

  const accepted = lines.filter((line) => line.resolution === "accepted");
  const conflicts = lines.filter((line) => line.resolution === "conflict");
  const unreviewed = lines.filter((line) => line.resolution === "unreviewed");

  const domains = Object.fromEntries(
    DOMAIN_ORDER.map((domain) => {
      const total = evaluation.lines.filter(
        (line) => line.domain === domain,
      ).length;
      const acceptedCount = accepted.filter(
        (line) => line.domain === domain,
      ).length;
      return [
        domain,
        {
          label: DOMAIN_LABELS[domain],
          accepted: acceptedCount,
          total,
          required: DOMAIN_MINIMUM,
          passed: acceptedCount >= DOMAIN_MINIMUM,
        },
      ];
    }),
  );

  const gateRequirementsMet =
    accepted.length >= TARGET_ACCEPTED &&
    unreviewed.length === 0 &&
    Object.values(domains).every((domain) => domain.passed);

  return {
    reviewers,
    lines,
    domains,
    summary: {
      reviewer_count: reviewers.length,
      accepted_lines: accepted.length,
      corrected_lines: accepted.filter((line) => line.changed).length,
      conflict_lines: conflicts.length,
      unreviewed_lines: unreviewed.length,
      target_accepted: TARGET_ACCEPTED,
      total_lines: evaluation.lines.length,
      gate_requirements_met: gateRequirementsMet,
      ready_to_lock: gateRequirementsMet && conflicts.length === 0,
    },
  };
}
