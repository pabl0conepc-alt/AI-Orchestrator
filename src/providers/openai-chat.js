// src/providers/openai-chat.js
// Adapter para qualquer API compatível com OpenAI Chat Completions (NVIDIA, Groq, Mistral,
// DeepSeek, OpenRouter, SambaNova, SiliconFlow, Chutes, MuleRouter, LLM7, Cerebras).

async function parse(response) {
  const raw = await response.text();
  try { return { data: JSON.parse(raw), raw }; } catch { return { data: { raw }, raw }; }
}

export async function callOpenAIChat(provider, { model, messages, temperature = 0.35, maxTokens = 4096, signal }) {
  const url = `${provider.baseUrl}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env[provider.envKey]}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || provider.defaultModel,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    }),
    signal
  });

  const { data } = await parse(response);
  if (!response.ok) {
    const error = new Error(data?.error?.message || data?.message || `Provider retornou HTTP ${response.status}`);
    error.status = response.status;
    error.providerPayload = data;
    throw error;
  }
  return {
    provider: provider.id,
    model: model || provider.defaultModel,
    text: data?.choices?.[0]?.message?.content ?? '',
    usage: data?.usage ?? null,
    raw: data
  };
}

// Streaming real via SSE: chama onDelta(texto) a cada fragmento e retorna o texto consolidado.
export async function streamOpenAIChat(provider, { model, messages, temperature = 0.35, maxTokens = 4096, onDelta, signal }) {
  const url = `${provider.baseUrl}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env[provider.envKey]}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || provider.defaultModel,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true
    }),
    signal
  });

  if (!response.ok) {
    const { data } = await parse(response);
    const error = new Error(data?.error?.message || `Provider retornou HTTP ${response.status}`);
    error.status = response.status;
    error.providerPayload = data;
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
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      let chunk;
      try { chunk = JSON.parse(payload); } catch { continue; }
      const delta = chunk?.choices?.[0]?.delta?.content || '';
      if (delta) { text += delta; if (onDelta) onDelta(delta); }
    }
  }
  return { provider: provider.id, model: model || provider.defaultModel, text, usage: null, streamed: true };
}
