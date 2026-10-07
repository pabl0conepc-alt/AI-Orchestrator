// src/orchestrator/debugger.js
import { detectProject } from '../tools/project.js';
import { runTool } from '../tools/registry.js';
import { executeTask } from '../agents/worker.js';
import { selectDiverse, TASK_PROFILES } from '../models/selection.js';
import { emit } from '../core/events.js';
import { remember } from '../memory/store.js';
import { envInt } from '../core/env.js';

// Loop autônomo: TESTAR → se falhar, DEBUGGER corrige (com ferramentas) → testar de novo.
// Limitado por MAX_DEBUG_ATTEMPTS para evitar loops infinitos.
export async function runDebugLoop({ request, project, catalog, preferFree = true, run = null, maxAttempts = envInt('MAX_DEBUG_ATTEMPTS', 3), initialTestCommand }) {
  const attempts = [];
  const safeProject = project || await detectProject();
  const testCommand = initialTestCommand || safeProject.testCommand;

  if (!testCommand) {
    return { ok: false, reason: 'Nenhum comando de teste detectado para este projeto.', attempts: [] };
  }

  const [debuggerModel] = await selectDiverse(catalog, 1, TASK_PROFILES.debug, { preferFree });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    emit('debug.attempt', { attempt, testCommand });
    const testResult = await runTool('run_tests', { command: testCommand });
    const passed = testResult.ok && !/fail(ed|ure)?\b/i.test(testResult.stdout || '') ;
    attempts.push({ attempt, phase: 'test', ok: Boolean(passed), summary: summarize(testResult) });
    if (run) await remember(run, { type: 'test', result: { attempt, ok: Boolean(passed), command: testCommand } });

    if (passed) {
      emit('debug.done', { ok: true, attempts: attempt });
      return { ok: true, attempts, testCommand };
    }

    if (!debuggerModel) return { ok: false, reason: 'Nenhum modelo de debug disponível.', attempts };

    emit('debug.fixing', { attempt, provider: debuggerModel.providerId, model: debuggerModel.modelId });
    const task = {
      id: `fix-${attempt}`,
      role: 'debugger',
      title: `Corrigir falha de teste (tentativa ${attempt})`,
      instruction: [
        'A suíte de testes falhou. Encontre a causa raiz, corrija o código com as ferramentas (read_file/write_file) e explique a correção.',
        `PEDIDO ORIGINAL:\n${request}`,
        `COMANDO DE TESTE:\n${testCommand}`,
        `SAÍDA DOS TESTES:\n${(testResult.stdout || '').slice(0, 4000)}`,
        `STDERR:\n${(testResult.stderr || '').slice(0, 2000)}`
      ].join('\n\n')
    };
    const context = { global: request, project: JSON.stringify({ root: safeProject.root, ecosystems: safeProject.ecosystems }) };
    try {
      const fix = await executeTask({ task, models: [debuggerModel], context });
      attempts.push({ attempt, phase: 'fix', ok: true, summary: fix.text.slice(0, 500), provider: fix.provider, model: fix.model });
    } catch (error) {
      attempts.push({ attempt, phase: 'fix', ok: false, error: error.message });
    }
  }

  const finalTest = await runTool('run_tests', { command: testCommand });
  const ok = finalTest.ok && !/fail(ed|ure)?\b/i.test(finalTest.stdout || '');
  emit('debug.done', { ok, attempts: maxAttempts });
  return { ok, attempts, testCommand, reason: ok ? null : `Não convergiu após ${maxAttempts} tentativas.` };
}

function summarize(result) {
  const text = `${result.stdout || ''}${result.stderr ? `\n[stderr]\n${result.stderr}` : ''}`.trim();
  return text.slice(0, 600) || (result.ok ? 'comando concluído' : 'falhou');
}
