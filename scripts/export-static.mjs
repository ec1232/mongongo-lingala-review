import { mkdir, writeFile } from "node:fs/promises";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("static-export", Date.now().toString());
const { default: worker } = await import(workerUrl.href);

const env = {
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
};
const context = {
  waitUntil() {},
  passThroughOnException() {},
};

for (const route of [
  { path: "/", output: "../dist/client/index.html" },
  { path: "/results", output: "../dist/client/results/index.html" },
]) {
  const response = await worker.fetch(
    new Request(`http://localhost${route.path}`, {
      headers: { accept: "text/html" },
    }),
    env,
    context,
  );
  if (!response.ok) {
    throw new Error(
      `Static export for ${route.path} failed with HTTP ${response.status}`,
    );
  }
  const outputUrl = new URL(route.output, import.meta.url);
  await mkdir(new URL("./", outputUrl), { recursive: true });
  await writeFile(outputUrl, await response.text());
}

console.log("Static review and private results dashboard exported.");
