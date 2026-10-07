// src/providers/opencode.js
// Adapter para a API de Responses do OpenCode Zen.

export async function callOpenCode(provider, { model, messages, maxTokens = 4096, signal }) {
  const url = `${provider.baseUrl}/responses`;
  const selectedModel = model || provider.defaultModel;
  const input = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: [{ type: 'input_text', text: m.content }] }));
  const instructions = messages.find((m) => m.role === 'system')?.content;

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env[provider.envKey]}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: selectedModel,
      input,
      ...(instructions ? { instructions } : {}),
      max_output_tokens: maxTokens
    }),
    signal
  });

  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { raw }; }
  if (!response.ok) {
    const error = new Error(data?.error?.message || `OpenCode retornou HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  let text = data?.output_text || '';
  if (!text && Array.isArray(data?.output)) {
    text = data.output.flatMap((item) => item.content || []).map((part) => part.text || '').join('');
  }
  return { provider: provider.id, model: selectedModel, text, usage: data?.usage || null, raw: data };
}
