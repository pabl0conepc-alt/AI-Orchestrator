// src/tools/permissions.js
import { envBool } from '../core/env.js';

export const PERMISSIONS = ['READ', 'WRITE', 'EXECUTE', 'DELETE', 'NETWORK'];

// Permissões habilitadas por padrão. Operações destrutivas (DELETE) ficam desligadas por padrão.
export function enabledPermissions() {
  return {
    READ: envBool('TOOLS_ALLOW_READ', true),
    WRITE: envBool('TOOLS_ALLOW_WRITE', true),
    EXECUTE: envBool('TOOLS_ALLOW_EXECUTE', true),
    DELETE: envBool('TOOLS_ALLOW_DELETE', false),
    NETWORK: envBool('TOOLS_ALLOW_NETWORK', true)
  };
}

export function assertPermission(permission, tool) {
  const enabled = enabledPermissions();
  if (!permission) return;
  for (const p of [].concat(permission)) {
    if (!enabled[p]) {
      const error = new Error(`Permissão ${p} desabilitada para a ferramenta "${tool}".`);
      error.status = 403;
      error.code = 'PERMISSION_DENIED';
      throw error;
    }
  }
}

export function permissionSummary() {
  const enabled = enabledPermissions();
  return PERMISSIONS.map((p) => ({ permission: p, enabled: enabled[p] }));
}
