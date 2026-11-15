export type OrbMode = 'GRAPHITE' | 'GOLD' | 'BIFRONTAL' | 'BLOCKED';

export interface WorkspacePolicy {
  defaultMode: OrbMode;
  allowCloudModels: boolean;
  allowWebSearch: boolean;
  allowSanitizedQueries: boolean;
  allowTelemetry: boolean;
  sensitivePatterns: string[];
  externalDisclosure: {
    sourceCode: 'allow' | 'deny' | 'redact';
    stackTraces: 'allow' | 'deny' | 'redact';
    dependencyNames: 'allow' | 'deny';
    packageVersions: 'allow' | 'deny';
    filePaths: 'allow' | 'deny' | 'redact';
    businessNames: 'allow' | 'deny' | 'redact';
  };
  approvalRequiredFor: string[];
}

export interface IntentAnalysis {
  intent: string;
  requiresLocalContext: boolean;
  requiresInternet: boolean;
  requiresExecution: boolean;
}

export interface SensitivityScan {
  containsSecrets: boolean;
  sensitivityLevel: 'low' | 'medium' | 'high' | 'critical';
  detectedSignals: string[];
}

export interface OrbDecision {
  mode: OrbMode;
  reason: string;
  requiresApproval: boolean;
  allowedTools: string[];
  forbiddenTools: string[];
  redactionRequired: boolean;
  policyUsed: WorkspacePolicy;
}

export interface SanitizedPayload {
  originalText: string;
  sanitizedText: string;
  redactedElements: string[];
}

export const DEFAULT_WORKSPACE_POLICY: WorkspacePolicy = {
  defaultMode: 'GRAPHITE',
  allowCloudModels: false,
  allowWebSearch: true,
  allowSanitizedQueries: true,
  allowTelemetry: false,
  sensitivePatterns: [
    '.env',
    'secrets.json',
    'credentials.json',
    'id_rsa',
    '*.pem',
    '*.key',
    'database',
    'stripe',
    'api_key',
    'password',
    'token'
  ],
  externalDisclosure: {
    sourceCode: 'deny',
    stackTraces: 'redact',
    dependencyNames: 'allow',
    packageVersions: 'allow',
    filePaths: 'redact',
    businessNames: 'redact'
  },
  approvalRequiredFor: [
    'web.search',
    'browser.open',
    'api.call.external',
    'cloud_model.invoke'
  ]
};

// 1. Intent Classifier
export function classifyIntent(prompt: string): IntentAnalysis {
  const p = prompt.toLowerCase();
  
  const localKeywords = ['repo', 'proyecto', 'archivo', 'carpeta', 'código', 'refactor', 'local', 'desktop', 'escritorio', 'file', 'read', 'write', 'terminal', 'analizar'];
  const internetKeywords = ['web', 'buscar', 'google', 'internet', 'documentación', 'cve', 'npm', 'librería', 'sitio', 'url', 'consulta', 'api externa', 'última versión'];
  const executionKeywords = ['ejecutar', 'run', 'start', 'test', 'docker', 'build', 'compilar', 'instalar'];

  const requiresLocalContext = localKeywords.some(kw => p.includes(kw));
  const requiresInternet = internetKeywords.some(kw => p.includes(kw));
  const requiresExecution = executionKeywords.some(kw => p.includes(kw));

  let intent = 'general_assistance';
  if (requiresLocalContext && requiresInternet) {
    intent = 'hybrid_debug_and_research';
  } else if (requiresLocalContext) {
    intent = 'local_file_engineering';
  } else if (requiresInternet) {
    intent = 'external_research';
  } else if (requiresExecution) {
    intent = 'terminal_automation';
  }

  return {
    intent,
    requiresLocalContext,
    requiresInternet,
    requiresExecution
  };
}

// 2. Sensitivity Scan
export function scanSensitivity(prompt: string, policy: WorkspacePolicy = DEFAULT_WORKSPACE_POLICY): SensitivityScan {
  const p = prompt.toLowerCase();
  const detectedSignals: string[] = [];
  let containsSecrets = false;

  // Scan for defined sensitive patterns or indicators
  for (const pattern of policy.sensitivePatterns) {
    const cleanPattern = pattern.replace(/\*/g, '');
    if (p.includes(cleanPattern)) {
      detectedSignals.push(pattern);
    }
  }

  // Scan for typical API keys / secrets / connection strings
  const secretRegexes = [
    /sk_[a-zA-Z0-9_]{10,}/, // Stripe secret keys
    /AIzaSy[a-zA-Z0-9_-]{35}/, // Google API keys
    /postgres:\/\/[a-zA-Z0-9_]+:[a-zA-Z0-9_]+@/, // DB URIs
    /ghp_[a-zA-Z0-9]{36}/, // GitHub tokens
    /[a-zA-Z0-9.-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}/ // Emails
  ];

  for (const regex of secretRegexes) {
    if (regex.test(prompt)) {
      containsSecrets = true;
      detectedSignals.push('pattern_secret_detected');
    }
  }

  let sensitivityLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (containsSecrets) {
    sensitivityLevel = 'critical';
  } else if (detectedSignals.length >= 3) {
    sensitivityLevel = 'high';
  } else if (detectedSignals.length >= 1) {
    sensitivityLevel = 'medium';
  }

  return {
    containsSecrets,
    sensitivityLevel,
    detectedSignals
  };
}

// 3. Load Workspace Policy (Simulated, but fully typed and dynamic)
export function loadWorkspacePolicy(customPolicyOverrides?: Partial<WorkspacePolicy>): WorkspacePolicy {
  return {
    ...DEFAULT_WORKSPACE_POLICY,
    ...customPolicyOverrides
  };
}

// 4. Decide Orb Mode
export function decideOrbMode(
  prompt: string,
  policyOverrides?: Partial<WorkspacePolicy>
): OrbDecision {
  const policy = loadWorkspacePolicy(policyOverrides);
  const intent = classifyIntent(prompt);
  const sensitivity = scanSensitivity(prompt, policy);

  // Critical Veto Rule: contains secrets or sensitive data violating absolute graphite limit
  if (sensitivity.containsSecrets) {
    return {
      mode: 'GRAPHITE',
      reason: 'Se detectaron credenciales, secretos criptográficos o enlaces de bases de datos. La red queda clausurada por integridad del terminal.',
      requiresApproval: false,
      allowedTools: ['filesystem.read', 'local_llm.invoke', 'database.read'],
      forbiddenTools: ['cloud_model.invoke', 'web.search', 'api.call.external'],
      redactionRequired: true,
      policyUsed: policy
    };
  }

  // Highly sensitive content in strict mode
  if (sensitivity.sensitivityLevel === 'high' && !policy.allowCloudModels) {
    return {
      mode: 'GRAPHITE',
      reason: 'El prompt contiene patrones altamente sensibles y los modelos de nube están vedados.',
      requiresApproval: false,
      allowedTools: ['filesystem.read', 'local_llm.invoke'],
      forbiddenTools: ['cloud_model.invoke', 'api.call.external'],
      redactionRequired: true,
      policyUsed: policy
    };
  }

  // Hybrid flow requires Bifrontal Context Crossing
  if (intent.requiresLocalContext && intent.requiresInternet) {
    return {
      mode: 'BIFRONTAL',
      reason: 'La consulta exige frontera: requiere analizar material propietario local y realizar consultas complementarias en la red celestial.',
      requiresApproval: true,
      allowedTools: ['filesystem.read', 'local_llm.invoke', 'redaction.sanitize', 'web.search', 'browser.open'],
      forbiddenTools: ['send_full_source_code', 'send_env_files', 'send_raw_logs'],
      redactionRequired: true,
      policyUsed: policy
    };
  }

  // Simple local flow -> Graphite Only
  if (intent.requiresLocalContext && !intent.requiresInternet) {
    return {
      mode: 'GRAPHITE',
      reason: 'La tarea pertenece exclusivamente al ámbito del escritorio local.',
      requiresApproval: false,
      allowedTools: ['filesystem.read', 'terminal.run', 'code.edit', 'local_llm.invoke'],
      forbiddenTools: ['cloud_model.invoke', 'web.search'],
      redactionRequired: false,
      policyUsed: policy
    };
  }

  // Simple web query -> Gold Mode
  if (!intent.requiresLocalContext && intent.requiresInternet) {
    return {
      mode: 'GOLD',
      reason: 'La consulta busca fuentes externas y documentación pública sin involucrar información propietaria.',
      requiresApproval: policy.approvalRequiredFor.includes('web.search'),
      allowedTools: ['web.search', 'browser.open', 'cloud_model.invoke'],
      forbiddenTools: [],
      redactionRequired: false,
      policyUsed: policy
    };
  }

  // Default Fallback
  return {
    mode: 'GRAPHITE',
    reason: 'Modo por defecto hermético asignado por prudencia del kernel.',
    requiresApproval: true,
    allowedTools: ['local_llm.invoke'],
    forbiddenTools: ['all_external'],
    redactionRequired: true,
    policyUsed: policy
  };
}

// 5. Redaction and Sanitization Engine
export function sanitizeExternalPayload(text: string): SanitizedPayload {
  let sanitizedText = text;
  const redactedElements: string[] = [];

  // Patterns to redact
  const redactions = [
    {
      name: 'Stripe API Key',
      regex: /sk_live_[a-zA-Z0-9_]{16,}/g,
      replacement: '[REDACTADO: STRIPE_SECRET_KEY]'
    },
    {
      name: 'Base de Datos URL',
      regex: /postgres:\/\/[a-zA-Z0-9_]+:[a-zA-Z0-9_]+@[a-zA-Z0-9.-]+\/[a-zA-Z0-9_-]+/g,
      replacement: 'postgres://[REDACTADO_USUARIO]:[REDACTADO_CONTRASEÑA]@[REDACTADO_HOST]/[REDACTADO_BD]'
    },
    {
      name: 'Ruta Local de Usuario',
      regex: /[a-zA-Z]:[\\/](Users|home)[\\/][a-zA-Z0-9_-]+/gi,
      replacement: '[REDACTADO: RUTA_LOCAL_SANTUARIO]'
    },
    {
      name: 'Email Privado',
      regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}/g,
      replacement: '[REDACTADO: CONTACTO_SEGURO]'
    }
  ];

  for (const r of redactions) {
    const matches = text.match(r.regex);
    if (matches) {
      matches.forEach(m => redactedElements.push(`${r.name}: "${m.substring(0, 8)}..."`));
      sanitizedText = sanitizedText.replace(r.regex, r.replacement);
    }
  }

  return {
    originalText: text,
    sanitizedText,
    redactedElements
  };
}

// Compatibility elements for server.ts and old simulation presets
import { OrbeMaterial } from './components/VisualOrbe';

export interface ToolManifest {
  id: string;
  name: string;
  description: string;
  preferredContext: 'local' | 'remote';
  canRunLocal: boolean;
  canRunRemote: boolean;
  requiresInternet: boolean;
  permissions: string[];
  touchesConfidential?: boolean;
}

export interface UserContext {
  forceLocal: boolean;
  forceRemote: boolean;
  isOnline: boolean;
  hasGpu: boolean;
  dataPolicy: 'local_only' | 'hybrid' | 'unrestricted';
  restrictToEu: boolean;
}

export interface RawStep {
  index: number;
  tool: string;
  action: string;
  queryOrParams: string;
  hasConfidentialData?: boolean;
}

export interface EnrichedStep extends RawStep {
  executionContext: 'local' | 'remote' | 'blocked';
  decisionReason: string;
  orbeMaterial: OrbeMaterial;
  warning?: string;
}

export interface OrbiterDecisionResult {
  steps: EnrichedStep[];
  overallPolicyStatus: 'approved' | 'restricted' | 'blocked';
  blockReason?: string;
}

export const TOOL_REGISTRY: ToolManifest[] = [
  {
    id: 'DesktopAgent',
    name: 'Desktop Automation Agent',
    description: 'Controla el sistema de archivos local, manipula archivos del espacio de trabajo y automatiza tareas del sistema operativo.',
    preferredContext: 'local',
    canRunLocal: true,
    canRunRemote: false,
    requiresInternet: false,
    permissions: ['filesystem', 'workspace_write', 'process_exec'],
    touchesConfidential: true
  },
  {
    id: 'BrowserAgent',
    name: 'Deep Browser Agent',
    description: 'Navega por la web, realiza web scraping de documentación y busca respuestas en la red pública.',
    preferredContext: 'remote',
    canRunLocal: false,
    canRunRemote: true,
    requiresInternet: true,
    permissions: ['network_access', 'html_scraping'],
    touchesConfidential: false
  },
  {
    id: 'CodeAgent',
    name: 'Sovereign Code Architect',
    description: 'Analiza la sintaxis de archivos de código, detecta errores, realiza refactorizaciones y propone arquitecturas de software.',
    preferredContext: 'local',
    canRunLocal: true,
    canRunRemote: true,
    requiresInternet: false,
    permissions: ['code_analysis', 'workspace_read'],
    touchesConfidential: true
  },
  {
    id: 'DatabaseAgent',
    name: 'Memory Vault SQLite Agent',
    description: 'Inscribe y lee codicilos en los archivos de datos herméticos, gestionando el historial persistente de Aglaia.',
    preferredContext: 'local',
    canRunLocal: true,
    canRunRemote: false,
    requiresInternet: false,
    permissions: ['sqlite_write', 'sqlite_read', 'vector_search'],
    touchesConfidential: true
  }
];

export class OrbiterCore {
  static enrichPlan(
    rawPlan: RawStep[],
    userContext: UserContext
  ): OrbiterDecisionResult {
    const enrichedSteps: EnrichedStep[] = [];
    let overallPolicyStatus: 'approved' | 'restricted' | 'blocked' = 'approved';
    let blockReason: string | undefined;

    for (const step of rawPlan) {
      const tool = TOOL_REGISTRY.find(t => t.id === step.tool);
      
      if (!tool) {
        enrichedSteps.push({
          ...step,
          executionContext: 'blocked',
          decisionReason: `Herramienta '${step.tool}' no registrada en el catálogo soberano.`,
          orbeMaterial: 'bronze',
          warning: 'Ejecución vetada por razones de integridad del kernel.'
        });
        overallPolicyStatus = 'blocked';
        blockReason = `La herramienta '${step.tool}' no forma parte del catálogo soberano de agentes.`;
        continue;
      }

      let context: 'local' | 'remote' | 'blocked' = 'local';
      let reason = '';
      let warning: string | undefined;
      let orbeMat: OrbeMaterial = 'graphite';

      // 1. Check Internet/Online requirement
      if (tool.requiresInternet && !userContext.isOnline) {
        context = 'blocked';
        reason = `La herramienta requiere conexión a Internet, pero el consultante declaró estar fuera de línea.`;
        orbeMat = 'bronze';
        overallPolicyStatus = 'blocked';
        blockReason = 'Un paso crítico requiere acceso web que actualmente está desactivado.';
      }
      // 2. Check Data Confidentiality Policies
      else if ((tool.touchesConfidential || step.hasConfidentialData) && userContext.dataPolicy === 'local_only') {
        if (tool.canRunLocal) {
          context = 'local';
          reason = 'Forzado a local por la Política de Confidencialidad Hermética (Local Only).';
          orbeMat = 'graphite';
        } else {
          // Requires remote but policy is local_only! Blocked!
          context = 'blocked';
          reason = `VETO: La herramienta '${tool.name}' requiere transmisión remota, infringiendo la política estricta de 'Local Only'.`;
          orbeMat = 'bronze';
          overallPolicyStatus = 'blocked';
          blockReason = `Conflicto de confidencialidad: la herramienta '${tool.name}' exige red exterior bajo modo hermético.`;
        }
      }
      // 3. User explicit force preferences
      else if (userContext.forceLocal) {
        if (tool.canRunLocal) {
          context = 'local';
          reason = 'Preferencia declarada por el consultante: Forzar ejecución local.';
          orbeMat = 'graphite';
        } else {
          context = 'blocked';
          reason = `La herramienta '${tool.name}' no tiene implementación de hardware local.`;
          orbeMat = 'bronze';
          overallPolicyStatus = 'blocked';
          blockReason = `Forzado Local insatisfecho por incapacidad de la herramienta '${tool.name}'.`;
        }
      }
      else if (userContext.forceRemote) {
        if (tool.canRunRemote) {
          context = 'remote';
          reason = 'Preferencia declarada por el consultante: Forzar APIs celestiales.';
          orbeMat = 'gold_liquid';
        } else {
          // Fallback to local
          context = 'local';
          reason = `La herramienta '${tool.name}' opera estrictamente en el host físico; no admite canalización remota.`;
          orbeMat = 'graphite';
          warning = 'Ignorando preferencia remota por requerimientos de hardware local.';
          overallPolicyStatus = 'restricted';
        }
      }
      // 4. Resource Constraints (e.g. GPU)
      else if (tool.preferredContext === 'local' && !userContext.hasGpu && tool.canRunRemote) {
        context = 'remote';
        reason = 'Insuficiencia de GPU local en el terminal del usuario; derivando cómputo a la red celestial.';
        orbeMat = 'gold_liquid';
        warning = 'Cómputo delegado por limitación de hardware local.';
      }
      // 5. EU Sovereignty constraints
      else {
        // Evaluate based on preferred context
        context = tool.preferredContext;
        reason = `Uso del contexto preferido según el manifiesto de la herramienta '${tool.name}'.`;
        orbeMat = context === 'local' ? 'graphite' : 'gold_liquid';
      }

      // Check EU restriction warning
      if (context === 'remote' && userContext.restrictToEu) {
        warning = 'Advertencia de Soberanía: Ejecución remota filtrada bajo directivas de la Unión Europea.';
        if (overallPolicyStatus !== 'blocked') {
          overallPolicyStatus = 'restricted';
        }
      }

      // Map success/normal visual states
      if (context === 'local') {
        orbeMat = 'graphite';
      } else if (context === 'remote') {
        orbeMat = 'gold_liquid';
      } else {
        orbeMat = 'bronze';
      }

      enrichedSteps.push({
        ...step,
        executionContext: context,
        decisionReason: reason,
        orbeMaterial: orbeMat,
        warning
      });
    }

    return {
      steps: enrichedSteps,
      overallPolicyStatus,
      blockReason
    };
  }
}
