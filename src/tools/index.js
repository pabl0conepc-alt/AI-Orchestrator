// src/tools/index.js
import { registerTools } from './registry.js';
import { fsTools } from './fs-tools.js';
import { gitTools } from './git-tools.js';
import { projectTools } from './project.js';

export function registerAllTools() {
  registerTools({ ...fsTools, ...gitTools, ...projectTools });
}

export * from './registry.js';
export { permissionSummary, enabledPermissions, PERMISSIONS } from './permissions.js';
export { detectProject, diagnostics } from './project.js';
