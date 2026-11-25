// Diagnostic reports sent from the app (Settings → Diagnostics → Send):
// written to this site's function log under a short code, in pieces, so they
// can be read back from Netlify's logs ("SGDIAG <code> <piece>/<count>").
// Nothing else is kept.

const PIECE = 3000;
const MAX = 400_000;

export default async (req) => {
  if (req.method !== "POST") return new Response("POST a report", { status: 405 });
  let text = await req.text();
  if (!text.trim()) return new Response("Empty", { status: 400 });
  if (text.length > MAX) text = `${text.slice(0, MAX)}\n… (cut at ${MAX} characters)`;
  const id = Math.random().toString(36).slice(2, 8).toUpperCase();
  const n = Math.ceil(text.length / PIECE);
  for (let i = 0; i < n; i++) console.log(`SGDIAG ${id} ${i + 1}/${n}\n${text.slice(i * PIECE, (i + 1) * PIECE)}`);
  return Response.json({ id, pieces: n });
};
