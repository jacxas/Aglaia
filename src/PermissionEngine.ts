import type { AglaiaEvent, SovereignEventBus, ToolManifest } from './orbiter_kernel';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type PolicyAction = 'allow' | 'confirm' | 'block';

export type PermissionDecision = 'allow' | 'require_confirmation' | 'block';

export interface PermissionPolicyConfig {
  /** Action policy evaluated per effective risk level */
  riskActions: Record<RiskLevel, PolicyAction>;
  /** Tool names explicitly blocked regardless of risk */
  blockedTools: string[];
  /** Tool names that always require explicit human confirmation */
  alwaysConfirmTools: string[];
  /** Tool names trusted for auto-execution unless escalated to high/critical or blocked */
  trustedTools: string[];
  /** Case-insensitive argument substrings that trigger an immediate policy block */
  blockedInputPatterns: string[];
  /** Immediately block any call containing detected secrets/credentials */
  blockOnSecretLeakage: boolean;
  /** Immediately block destructive OS/shell commands */
  blockDestructiveCommands: boolean;
  /** Block any tool requiring remote/network/browser execution */
  strictLocalOnly: boolean;
  /** Optional confirmation timeout in ms (0 = wait indefinitely for human decision) */
  confirmationTimeoutMs: number;
}

export type PermissionPolicyOverrides = Partial<Omit<PermissionPolicyConfig, 'riskActions'>> & {
  riskActions?: Partial<Record<RiskLevel, PolicyAction>>;
};

export const DEFAULT_PERMISSION_POLICY: PermissionPolicyConfig = {
  riskActions: {
    low: 'allow',
    medium: 'confirm',
    high: 'confirm',
    critical: 'confirm',
  },
  blockedTools: ['sovereign.wallet.transfer'],
  alwaysConfirmTools: [],
  trustedTools: [],
  blockedInputPatterns: ['mkfs.', ':(){'],
  blockOnSecretLeakage: false,
  blockDestructiveCommands: false,
  strictLocalOnly: false,
  confirmationTimeoutMs: 0,
};

export interface RiskEvaluation {
  baseRisk: RiskLevel;
  effectiveRisk: RiskLevel;
  requiresConfirmation: boolean;
  blockedByPolicy: boolean;
  decision: PermissionDecision;
  policyRuleTriggered?: string;
  reasons: string[];
  matchedSignals: string[];
}

export interface InterceptCallTool {
  id: string;
  name: string;
  risk: RiskLevel;
  sensitivity?: string;
  domain?: string;
  execution?: 'local' | 'remote' | 'hybrid';
}

export interface InterceptCallInput {
  taskId: string;
  stepIndex: number;
  stepId?: string;
  tool: Pick<ToolManifest, 'id' | 'name' | 'risk'> &
    Partial<Pick<ToolManifest, 'sensitivity' | 'domain' | 'execution'>>;
  input: Record<string, any>;
  reason?: string;
}

export interface PendingPermissionRequest {
  requestId: string;
  taskId: string;
  stepIndex: number;
  stepId?: string;
  toolName: string;
  toolId: string;
  risk: RiskLevel;
  reason: string;
  matchedSignals: string[];
  inputPreview: Record<string, any>;
  requestedAt: number;
}

export interface PermissionInterceptionResult {
  allowed: boolean;
  evaluation: RiskEvaluation;
  requestId?: string;
  waitedForUser: boolean;
  resolvedBy:
    | 'auto_low_risk'
    | 'policy_allowed'
    | 'policy_blocked'
    | 'user_granted'
    | 'user_denied'
    | 'timeout';
  denialReason?: string;
  waitDurationMs: number;
}

export interface PermissionAuditEntry {
  id: string;
  requestId?: string;
  taskId: string;
  stepIndex: number;
  toolName: string;
  risk: RiskLevel;
  allowed: boolean;
  resolvedBy: PermissionInterceptionResult['resolvedBy'];
  waitDurationMs: number;
  reason: string;
  timestamp: string;
}

export interface PermissionEngineOptions {
  /** Initial policy overrides */
  policy?: PermissionPolicyOverrides;
  /** Shortcut for confirmationTimeoutMs */
  confirmationTimeoutMs?: number;
  /** Shortcut for alwaysConfirmTools */
  alwaysConfirmTools?: string[];
}

const RISK_ORDER: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function elevateRisk(current: RiskLevel, candidate: RiskLevel): RiskLevel {
  return RISK_ORDER[candidate] > RISK_ORDER[current] ? candidate : current;
}

/**
 * PermissionEngine
 *
 * Intercepts agent/tool calls prior to execution, validates step risk
 * (`low` | `medium` | `high` | `critical`), enforces configurable blocking
 * policies, and pauses execution asynchronously on `SovereignEventBus` to
 * request explicit human confirmation whenever risk is `medium` or higher.
 */
export class PermissionEngine {
  private pendingRequests: Map<string, PendingPermissionRequest> = new Map();
  private auditTrail: PermissionAuditEntry[] = [];
  private requestCounter = 0;
  private policy: PermissionPolicyConfig;

  constructor(
    private readonly eventBus: SovereignEventBus,
    options: PermissionEngineOptions = {}
  ) {
    this.policy = this.mergePolicy(DEFAULT_PERMISSION_POLICY, {
      ...(options.policy ?? {}),
      ...(typeof options.confirmationTimeoutMs === 'number'
        ? { confirmationTimeoutMs: options.confirmationTimeoutMs }
        : {}),
      ...(options.alwaysConfirmTools
        ? { alwaysConfirmTools: options.alwaysConfirmTools }
        : {}),
    });
  }

  private mergePolicy(
    base: PermissionPolicyConfig,
    overrides: PermissionPolicyOverrides
  ): PermissionPolicyConfig {
    return {
      ...base,
      ...overrides,
      riskActions: {
        ...base.riskActions,
        ...(overrides.riskActions ?? {}),
      },
      blockedTools: overrides.blockedTools ? [...overrides.blockedTools] : [...base.blockedTools],
      alwaysConfirmTools: overrides.alwaysConfirmTools
        ? [...overrides.alwaysConfirmTools]
        : [...base.alwaysConfirmTools],
      trustedTools: overrides.trustedTools ? [...overrides.trustedTools] : [...base.trustedTools],
      blockedInputPatterns: overrides.blockedInputPatterns
        ? [...overrides.blockedInputPatterns]
        : [...base.blockedInputPatterns],
    };
  }

  public getPolicy(): PermissionPolicyConfig {
    return this.mergePolicy(this.policy, {});
  }

  public updatePolicy(overrides: PermissionPolicyOverrides): PermissionPolicyConfig {
    this.policy = this.mergePolicy(this.policy, overrides);
    return this.getPolicy();
  }

  public resetPolicy(): PermissionPolicyConfig {
    this.policy = this.mergePolicy(DEFAULT_PERMISSION_POLICY, {});
    return this.getPolicy();
  }

  /**
   * Evaluates the effective risk level and policy decision for a step by combining
   * declared tool risk, dynamic argument inspection, and configurable policy rules.
   */
  public evaluateStepRisk(
    tool: InterceptCallTool,
    input: Record<string, any> = {}
  ): RiskEvaluation {
    const baseRisk: RiskLevel = tool.risk;
    let effectiveRisk: RiskLevel = baseRisk;
    const reasons: string[] = [
      `Riesgo base declarado de '${tool.name}': ${baseRisk.toUpperCase()}.`,
    ];
    const matchedSignals: string[] = [];

    let blockedByPolicy = false;
    let policyRuleTriggered: string | undefined;

    const serializedInput = JSON.stringify(input || {});
    const lowered = serializedInput.toLowerCase();

    // 1. Destructive command detection -> critical
    let hasDestructiveSignal = false;
    const destructivePatterns: Array<{ regex: RegExp; label: string }> = [
      { regex: /\brm\s+-rf\b/i, label: 'destructive_rm_rf' },
      { regex: /\b(mkfs|dd\s+if=|format\s+|shutdown|reboot)\b/i, label: 'system_destructive_op' },
      { regex: /\bchmod\s+777\b/i, label: 'insecure_permissions' },
      { regex: /:\(\)\s*\{/, label: 'fork_bomb_pattern' },
    ];
    for (const pattern of destructivePatterns) {
      if (pattern.regex.test(serializedInput)) {
        hasDestructiveSignal = true;
        effectiveRisk = elevateRisk(effectiveRisk, 'critical');
        matchedSignals.push(pattern.label);
        reasons.push(`Patrón destructivo detectado (${pattern.label}): escalado a CRITICAL.`);
      }
    }

    // 2. Credential / secret patterns -> high or critical
    let hasSecretSignal = false;
    const secretPatterns: Array<{ regex: RegExp; label: string }> = [
      { regex: /sk_(live|test)_[a-zA-Z0-9_]{8,}/, label: 'stripe_secret_key' },
      { regex: /AIzaSy[a-zA-Z0-9_-]{20,}/, label: 'google_api_key' },
      { regex: /ghp_[a-zA-Z0-9]{20,}/, label: 'github_pat_token' },
      { regex: /postgres:\/\/[^\s"']+:[^\s"']+@/i, label: 'database_credentials_uri' },
      { regex: /\b(\.env|secrets\.json|credentials\.json|id_rsa|\.pem|\.key)\b/i, label: 'sensitive_secret_file' },
    ];
    for (const pattern of secretPatterns) {
      if (pattern.regex.test(serializedInput)) {
        hasSecretSignal = true;
        const escalated: RiskLevel =
          tool.name.includes('write') || tool.name.includes('execute') || tool.name.includes('post')
            ? 'critical'
            : 'high';
        effectiveRisk = elevateRisk(effectiveRisk, escalated);
        matchedSignals.push(pattern.label);
        reasons.push(`Material sensible detectado (${pattern.label}): escalado a ${escalated.toUpperCase()}.`);
      }
    }

    // 3. Sensitive OS paths -> at least high
    if (/(\/etc\/|\/var\/db\/|\/root\/|c:\\windows\\)/i.test(lowered)) {
      effectiveRisk = elevateRisk(effectiveRisk, 'high');
      matchedSignals.push('system_protected_path');
      reasons.push('Acceso a ruta protegida del sistema operativo: escalado a HIGH.');
    }

    // 4. Write / mutate operations ensure at least medium
    if (
      (tool.name.includes('write') || input?.action === 'write' || tool.sensitivity === 'SECRET') &&
      RISK_ORDER[effectiveRisk] < RISK_ORDER.medium
    ) {
      effectiveRisk = elevateRisk(effectiveRisk, 'medium');
      matchedSignals.push('state_mutation');
      reasons.push('Operación de escritura o mutación persistente: elevado a MEDIUM.');
    }

    // --- Configurable Policy Blocking Checks ---

    // P1: Explicitly blocked tool
    if (this.policy.blockedTools.includes(tool.name)) {
      blockedByPolicy = true;
      policyRuleTriggered = 'blocked_tool_list';
      matchedSignals.push('policy_blocked_tool');
      reasons.push(`Bloqueo por política: la herramienta '${tool.name}' está en la lista de veto absoluto.`);
    }

    // P2: Blocked input pattern
    for (const rawPattern of this.policy.blockedInputPatterns) {
      const normalized = rawPattern.trim().toLowerCase();
      if (normalized && lowered.includes(normalized)) {
        blockedByPolicy = true;
        policyRuleTriggered = 'blocked_input_pattern';
        matchedSignals.push(`pattern:${rawPattern}`);
        reasons.push(`Bloqueo por política: el payload coincide con el patrón prohibido '${rawPattern}'.`);
        break;
      }
    }

    // P3: Strict local-only isolation
    if (
      !blockedByPolicy &&
      this.policy.strictLocalOnly &&
      (tool.execution === 'remote' || tool.domain === 'network' || tool.domain === 'browser')
    ) {
      blockedByPolicy = true;
      policyRuleTriggered = 'strict_local_only';
      matchedSignals.push('policy_strict_local_only');
      reasons.push(`Bloqueo por política: modo 'strictLocalOnly' activo impide llamadas remotas o de red (${tool.name}).`);
    }

    // P4: Block destructive commands policy
    if (!blockedByPolicy && this.policy.blockDestructiveCommands && hasDestructiveSignal) {
      blockedByPolicy = true;
      policyRuleTriggered = 'block_destructive_commands';
      matchedSignals.push('policy_block_destructive');
      reasons.push('Bloqueo por política: ejecución destructiva vetada por directiva `blockDestructiveCommands`.');
    }

    // P5: Block secret leakage policy
    if (!blockedByPolicy && this.policy.blockOnSecretLeakage && hasSecretSignal) {
      blockedByPolicy = true;
      policyRuleTriggered = 'block_on_secret_leakage';
      matchedSignals.push('policy_block_secrets');
      reasons.push('Bloqueo por política: detección de credenciales vetada por `blockOnSecretLeakage`.');
    }

    // P6: Risk-level action matrix (low / medium / high / critical)
    const configuredRiskAction = this.policy.riskActions[effectiveRisk];
    if (!blockedByPolicy && configuredRiskAction === 'block') {
      blockedByPolicy = true;
      policyRuleTriggered = `risk_action_${effectiveRisk}_block`;
      matchedSignals.push(`policy_risk_${effectiveRisk}_block`);
      reasons.push(`Bloqueo por política: el nivel de riesgo ${effectiveRisk.toUpperCase()} está configurado en modo 'block'.`);
    }

    // Determine final decision: block > require_confirmation > allow
    let decision: PermissionDecision;
    if (blockedByPolicy) {
      decision = 'block';
    } else if (this.policy.alwaysConfirmTools.includes(tool.name)) {
      decision = 'require_confirmation';
      matchedSignals.push('always_confirm_policy');
      reasons.push(`Herramienta '${tool.name}' marcada con confirmación humana obligatoria.`);
    } else if (
      this.policy.trustedTools.includes(tool.name) &&
      RISK_ORDER[effectiveRisk] <= RISK_ORDER.medium
    ) {
      decision = 'allow';
      reasons.push(`Herramienta '${tool.name}' autorizada por política 'trustedTools'.`);
    } else if (configuredRiskAction === 'confirm' || RISK_ORDER[effectiveRisk] >= RISK_ORDER.medium) {
      // Enforce human confirmation whenever risk is medium or higher (unless trusted or blocked)
      decision = configuredRiskAction === 'allow' && RISK_ORDER[effectiveRisk] < RISK_ORDER.medium
        ? 'allow'
        : RISK_ORDER[effectiveRisk] >= RISK_ORDER.medium
        ? 'require_confirmation'
        : 'confirm' === configuredRiskAction
        ? 'require_confirmation'
        : 'allow';
    } else {
      decision = 'allow';
    }

    const requiresConfirmation = decision === 'require_confirmation';

    return {
      baseRisk,
      effectiveRisk,
      requiresConfirmation,
      blockedByPolicy,
      decision,
      policyRuleTriggered,
      reasons,
      matchedSignals,
    };
  }

  /**
   * Intercepts a step/tool invocation before execution:
   * - `block`: Immediately vetoes via configurable policy, emits `permission:denied`, and does not wait.
   * - `allow` (`low` risk / trusted): Proceeds immediately without pausing.
   * - `require_confirmation` (`medium`, `high`, or `critical` risk): Emits `permission:requested` on
   *   `SovereignEventBus` and pauses asynchronously until `permission:granted` or `permission:denied` is emitted.
   */
  public async interceptCall(call: InterceptCallInput): Promise<PermissionInterceptionResult> {
    const startedAt = Date.now();
    const evaluation = this.evaluateStepRisk(call.tool, call.input);
    const summaryReason = call.reason || evaluation.reasons.join(' ');

    // 1. Hard Policy Block
    if (evaluation.decision === 'block') {
      const requestId = `policy-veto-${++this.requestCounter}-${Date.now()}`;
      this.eventBus.emit({
        type: 'permission:denied',
        payload: {
          taskId: call.taskId,
          stepIndex: call.stepIndex,
          requestId,
          reason: summaryReason,
        },
      });
      this.recordAudit({
        requestId,
        taskId: call.taskId,
        stepIndex: call.stepIndex,
        toolName: call.tool.name,
        risk: evaluation.effectiveRisk,
        allowed: false,
        resolvedBy: 'policy_blocked',
        waitDurationMs: 0,
        reason: summaryReason,
      });
      return {
        allowed: false,
        evaluation,
        requestId,
        waitedForUser: false,
        resolvedBy: 'policy_blocked',
        denialReason: summaryReason,
        waitDurationMs: 0,
      };
    }

    // 2. Auto-Allow (Low risk or explicit trusted policy)
    if (evaluation.decision === 'allow') {
      const resolvedBy =
        this.policy.trustedTools.includes(call.tool.name) && RISK_ORDER[evaluation.effectiveRisk] > RISK_ORDER.low
          ? 'policy_allowed'
          : 'auto_low_risk';
      this.recordAudit({
        taskId: call.taskId,
        stepIndex: call.stepIndex,
        toolName: call.tool.name,
        risk: evaluation.effectiveRisk,
        allowed: true,
        resolvedBy,
        waitDurationMs: 0,
        reason: summaryReason,
      });
      return {
        allowed: true,
        evaluation,
        waitedForUser: false,
        resolvedBy,
        waitDurationMs: 0,
      };
    }

    // 3. Asynchronous Pause on SovereignEventBus for Human Confirmation (Medium / High / Critical)
    const requestId = `perm-${++this.requestCounter}-${Date.now()}`;
    const pendingRequest: PendingPermissionRequest = {
      requestId,
      taskId: call.taskId,
      stepIndex: call.stepIndex,
      stepId: call.stepId,
      toolName: call.tool.name,
      toolId: call.tool.id,
      risk: evaluation.effectiveRisk,
      reason: summaryReason,
      matchedSignals: evaluation.matchedSignals,
      inputPreview: call.input,
      requestedAt: startedAt,
    };

    this.pendingRequests.set(requestId, pendingRequest);

    const timeoutMs = this.policy.confirmationTimeoutMs;

    const resolution = await new Promise<{
      allowed: boolean;
      resolvedBy: 'user_granted' | 'user_denied' | 'timeout';
      denialReason?: string;
    }>((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let unsubGranted: (() => void) | void;
      let unsubDenied: (() => void) | void;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        if (typeof unsubGranted === 'function') unsubGranted();
        if (typeof unsubDenied === 'function') unsubDenied();
        this.pendingRequests.delete(requestId);
      };

      const matchesTarget = (payload: { requestId?: string; taskId: string; stepIndex: number }) => {
        if (payload.requestId) {
          return payload.requestId === requestId;
        }
        return payload.taskId === call.taskId && payload.stepIndex === call.stepIndex;
      };

      unsubGranted = this.eventBus.subscribe('permission:granted', (event: AglaiaEvent) => {
        if (settled || event.type !== 'permission:granted') return;
        if (!matchesTarget(event.payload)) return;
        settled = true;
        cleanup();
        resolve({ allowed: true, resolvedBy: 'user_granted' });
      });

      unsubDenied = this.eventBus.subscribe('permission:denied', (event: AglaiaEvent) => {
        if (settled || event.type !== 'permission:denied') return;
        if (!matchesTarget(event.payload)) return;
        settled = true;
        cleanup();
        resolve({
          allowed: false,
          resolvedBy: 'user_denied',
          denialReason: event.payload.reason || 'Confirmación denegada explícitamente por el usuario.',
        });
      });

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          const timeoutReason = `Tiempo de espera agotado (${timeoutMs}ms) sin confirmación humana.`;
          this.eventBus.emit({
            type: 'permission:denied',
            payload: {
              taskId: call.taskId,
              stepIndex: call.stepIndex,
              requestId,
              reason: timeoutReason,
            },
          });
          resolve({
            allowed: false,
            resolvedBy: 'timeout',
            denialReason: timeoutReason,
          });
        }, timeoutMs);
      }

      // Emit permission:requested after subscribing so listeners never miss the pause signal
      this.eventBus.emit({
        type: 'permission:requested',
        payload: {
          taskId: call.taskId,
          stepIndex: call.stepIndex,
          stepId: call.stepId,
          requestId,
          tool: call.tool.name,
          permission: `${call.tool.id}:${call.tool.name}`,
          risk: evaluation.effectiveRisk,
          input: call.input,
          reason: summaryReason,
          matchedSignals: evaluation.matchedSignals,
        },
      });
    });

    const waitDurationMs = Math.max(0, Date.now() - startedAt);
    this.recordAudit({
      requestId,
      taskId: call.taskId,
      stepIndex: call.stepIndex,
      toolName: call.tool.name,
      risk: evaluation.effectiveRisk,
      allowed: resolution.allowed,
      resolvedBy: resolution.resolvedBy,
      waitDurationMs,
      reason: resolution.denialReason || summaryReason,
    });

    return {
      allowed: resolution.allowed,
      evaluation,
      requestId,
      waitedForUser: true,
      resolvedBy: resolution.resolvedBy,
      denialReason: resolution.denialReason,
      waitDurationMs,
    };
  }

  /**
   * Grants a paused permission request and resumes execution on SovereignEventBus.
   */
  public grantPermission(requestId: string, approvedBy = 'user'): boolean {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return false;

    this.eventBus.emit({
      type: 'permission:granted',
      payload: {
        taskId: pending.taskId,
        stepIndex: pending.stepIndex,
        requestId: pending.requestId,
        approvedBy,
      },
    });
    return true;
  }

  /**
   * Denies a paused permission request and aborts the intercepted call on SovereignEventBus.
   */
  public denyPermission(requestId: string, reason = 'Denegado explícitamente por el usuario.'): boolean {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) return false;

    this.eventBus.emit({
      type: 'permission:denied',
      payload: {
        taskId: pending.taskId,
        stepIndex: pending.stepIndex,
        requestId: pending.requestId,
        reason,
      },
    });
    return true;
  }

  public getPendingRequests(): PendingPermissionRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  public getAuditTrail(): PermissionAuditEntry[] {
    return [...this.auditTrail];
  }

  private recordAudit(entry: Omit<PermissionAuditEntry, 'id' | 'timestamp'>) {
    this.auditTrail.unshift({
      ...entry,
      id: `audit-${this.auditTrail.length + 1}-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    });
    if (this.auditTrail.length > 100) {
      this.auditTrail = this.auditTrail.slice(0, 100);
    }
  }
}
