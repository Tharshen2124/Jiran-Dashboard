// Server-only. Sends one prompt to Groq and returns the reply text.
// Pass a JSON schema to get the reply back as JSON matching it.
export async function askGroq(system: string, user: string, schema?: object) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-20b",
      reasoning_effort: "low",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(schema && {
        response_format: {
          type: "json_schema",
          json_schema: { name: "result", strict: true, schema },
        },
      }),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);

  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? "").trim() as string;
}
