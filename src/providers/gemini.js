// src/providers/gemini.js
// Adapter Google Gemini. Envia a chave no header `x-goog-api-key` (evita vazamento em query string/logs).

function splitMessages(messages) {
  const systemParts = [];
  const contents = [];
  for (const message of messages) {
    if (message.role === 'system') systemParts.push({ text: message.content });
    else contents.push({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] });
  }
  return { systemParts, contents };
}

export async function callGemini(provider, { model, messages, temperature = 0.35, maxTokens = 4096, signal }) {
  const selectedModel = model || provider.defaultModel;
  const url = `${provider.baseUrl}/models/${encodeURIComponent(selectedModel)}:generateContent`;
  const { systemParts, contents } = splitMessages(messages);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env[provider.envKey] || '' },
    body: JSON.stringify({
      ...(systemParts.length ? { systemInstruction: { parts: systemParts } } : {}),
      contents,
      generationConfig: { temperature, maxOutputTokens: maxTokens }
    }),
    signal
  });

  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { raw }; }
  if (!response.ok) {
    const error = new Error(data?.error?.message || `Google AI retornou HTTP ${response.status}`);
    error.status = response.status;
    error.providerPayload = data;
    throw error;
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  return { provider: provider.id, model: selectedModel, text, usage: data?.usageMetadata || null, raw: data };
}

export async function streamGemini(provider, { model, messages, temperature = 0.35, maxTokens = 4096, onDelta, signal }) {
  const selectedModel = model || provider.defaultModel;
  const url = `${provider.baseUrl}/models/${encodeURIComponent(selectedModel)}:streamGenerateContent?alt=sse`;
  const { systemParts, contents } = splitMessages(messages);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env[provider.envKey] || '' },
    body: JSON.stringify({
      ...(systemParts.length ? { systemInstruction: { parts: systemParts } } : {}),
      contents,
      generationConfig: { temperature, maxOutputTokens: maxTokens }
    }),
    signal
  });

  if (!response.ok) {
    const raw = await response.text();
    let data; try { data = JSON.parse(raw); } catch { data = { raw }; }
    const error = new Error(data?.error?.message || `Google AI retornou HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      let chunk; try { chunk = JSON.parse(trimmed.slice(5).trim()); } catch { continue; }
      const delta = chunk?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
      if (delta) { text += delta; if (onDelta) onDelta(delta); }
    }
  }
  return { provider: provider.id, model: selectedModel, text, usage: null, streamed: true };
}
