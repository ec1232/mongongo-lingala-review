import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the Évaluation Lingala review shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>Évaluation Lingala — Native-speaker review<\/title>/i,
  );
  assert.match(html, /Préparation de l’évaluation/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);

  const staticHtml = await readFile(
    new URL("dist/client/index.html", root),
    "utf8",
  );
  assert.equal(staticHtml, html);
});

test("packages the exact held-out 50-line prototype evaluation", async () => {
  const [packaged, source] = await Promise.all([
    readFile(new URL("public/evaluation.json", root)),
    readFile(new URL("../eval/lingala_eval_prototype.json", root)),
  ]);
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  assert.equal(hash(packaged), hash(source));

  const evaluation = JSON.parse(packaged.toString("utf8"));
  assert.equal(
    evaluation.set_id,
    "lingala-v1-eval-prototype-2026-07-29-v1",
  );
  assert.equal(evaluation.held_out, true);
  assert.equal(evaluation.training_use, "prohibited");
  assert.equal(evaluation.lines.length, 50);
  assert.equal(new Set(evaluation.lines.map((line) => line.id)).size, 50);
  assert.equal(evaluation.lines[0].id, "LNG-001");
  assert.equal(evaluation.lines.at(-1).id, "LNG-200");
});

test("keeps submission private, constrained, and easy for reviewers", async () => {
  const [page, frenchAids, css, layout] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/intents-fr.ts", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
  ]);

  assert.match(page, /localStorage\.setItem/);
  assert.match(page, /useState<Locale>\("fr"\)/);
  assert.match(page, /navigator\.language/);
  assert.match(page, /functions\/v1\/submit-lingala-review/);
  assert.match(page, /method:\s*"POST"/);
  assert.match(page, /contact@intellingo\.app/);
  assert.match(page, /Envoyer mes réponses/);
  assert.match(page, /Submit my answers/);
  assert.match(page, /new File/);
  assert.match(page, /link\.download/);
  assert.match(page, /approved_as_written/);
  assert.match(page, /approved_with_correction/);
  assert.match(page, /needs_discussion/);
  assert.match(page, /result_type:\s*"lingala_native_text_review"/);
  assert.match(page, /const TARGET_APPROVALS = 40/);
  assert.match(page, /stats\.reviewed === dataset\.lines\.length/);
  assert.match(page, /if \(!dataset \|\| !session \|\| !allReviewed \|\| submitting\) return/);
  assert.match(page, /Après les 50 phrases/);
  assert.match(page, /After all 50 sentences/);
  assert.match(page, /transmis en privé à contact@intellingo\.app/);
  assert.match(page, /sent privately to contact@intellingo\.app/);
  assert.doesNotMatch(page, /navigator\.share/);

  const ids = [...frenchAids.matchAll(/"LNG-\d{3}":/g)].map((match) =>
    match[0].slice(1, 8),
  );
  assert.equal(ids.length, 200);
  assert.equal(new Set(ids).size, 200);
  assert.equal(ids[0], "LNG-001");
  assert.equal(ids.at(-1), "LNG-200");

  assert.match(css, /@media \(max-width: 370px\)/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /min-height:\s*100svh/);
  assert.match(css, /touch-action:\s*manipulation/);
  assert.doesNotMatch(layout, /maximumScale/);
});

test("renders and statically exports the private results route", async () => {
  const response = await render("/results");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>Lingala Review Results — Private dashboard<\/title>/i,
  );
  assert.match(html, /Opening the private results desk/);

  const staticHtml = await readFile(
    new URL("dist/client/results/index.html", root),
    "utf8",
  );
  assert.equal(staticHtml, html);
});
