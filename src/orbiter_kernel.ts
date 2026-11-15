import type { PermissionEngine } from './PermissionEngine';

export type AglaiaEvent =
  | { type: 'execution:started'; payload: { taskId: string; stepsCount: number } }
  | { type: 'execution:step_started'; payload: { taskId: string; stepIndex: number; tool: string; action: string } }
  | { type: 'execution:step_completed'; payload: { taskId: string; stepIndex: number; observation: any } }
  | { type: 'execution:step_failed'; payload: { taskId: string; stepIndex: number; error: string } }
  | {
      type: 'permission:requested';
      payload: {
        taskId: string;
        stepIndex: number;
        stepId?: string;
        requestId?: string;
        tool: string;
        permission: string;
        risk: 'low' | 'medium' | 'high' | 'critical';
        input?: Record<string, any>;
        reason?: string;
        matchedSignals?: string[];
      };
    }
  | {
      type: 'permission:granted';
      payload: {
        taskId: string;
        stepIndex: number;
        requestId?: string;
        approvedBy?: string;
      };
    }
  | {
      type: 'permission:denied';
      payload: {
        taskId: string;
        stepIndex: number;
        requestId?: string;
        reason: string;
      };
    }
  | { type: 'memory:updated'; payload: { key: string; updateType: 'insert' | 'update' | 'link' } }
  | { type: 'execution:finished'; payload: { taskId: string; status: 'success' | 'failed' } };

export class SovereignEventBus {
  private listeners: Map<string, Array<(event: AglaiaEvent) => void>> = new Map();

  subscribe(eventType: string, callback: (event: AglaiaEvent) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    const list = this.listeners.get(eventType)!;
    list.push(callback);

    return () => {
      const current = this.listeners.get(eventType);
      if (!current) return;
      const idx = current.indexOf(callback);
      if (idx !== -1) {
        current.splice(idx, 1);
      }
    };
  }

  emit(event: AglaiaEvent) {
    const wildcards = this.listeners.get('*') || [];
    const specific = this.listeners.get(event.type) || [];
    [...wildcards, ...specific].forEach(callback => callback(event));
  }

  waitForEvent<T extends AglaiaEvent['type']>(
    eventType: T,
    predicate?: (event: Extract<AglaiaEvent, { type: T }>) => boolean,
    timeoutMs = 0
  ): Promise<Extract<AglaiaEvent, { type: T }>> {
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const unsub = this.subscribe(eventType, (event) => {
        const typed = event as Extract<AglaiaEvent, { type: T }>;
        if (predicate && !predicate(typed)) return;
        if (timer) clearTimeout(timer);
        unsub();
        resolve(typed);
      });

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          unsub();
          reject(new Error(`Timeout waiting for event '${eventType}' after ${timeoutMs}ms`));
        }, timeoutMs);
      }
    });
  }
}

/**
 * 🏛️ AGLAIA OS — KERNEL v1 — LEVEL 0 ARCHITECTURE
 * 
 * Este archivo implementa el núcleo determinista y desacoplado para Aglaia OS.
 * Integra:
 *   1. El Registro e Implementación de DesktopAgent (Filesystem, Terminal, Clipboard)
 *   2. La Arquitectura de MemoryAgent (SQLite Knowledge Graph & Vectores Semánticos Locales)
 *   3. El Motor del Planner & Reasoner Loop (Plan -> Execute -> Observe -> Re-plan)
 */

// ==========================================
// SECTION I: DEFINITIONS & SCHEMAS
// ==========================================

export interface ToolManifest {
  id: string;
  name: string;
  domain: 'desktop' | 'browser' | 'code' | 'memory' | 'network';
  execution: 'local' | 'remote' | 'hybrid';
  risk: 'low' | 'medium' | 'high' | 'critical';
  sensitivity: 'PUBLIC' | 'INTERNAL' | 'PRIVATE' | 'SECRET' | 'CRITICAL';
  description: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  handler: (input: any, context: any) => Promise<any>;
}

export interface ExecutionContext {
  taskId: string;
  workspacePath: string;
  isOnline: boolean;
  hasGpu: boolean;
  strictSovereignty: boolean;
}

// ==========================================
// SECTION II: DESKTOP AGENT IMPLEMENTATION
// ==========================================

export class DesktopAgent {
  private registeredTools: Map<string, ToolManifest> = new Map();

  constructor() {
    this.initializeDefaultTools();
  }

  private initializeDefaultTools() {
    // 1. Filesystem Read Tool
    this.register({
      id: 'CAP-001',
      name: 'desktop.fs.read',
      domain: 'desktop',
      execution: 'local',
      risk: 'low',
      sensitivity: 'PRIVATE',
      description: 'Lee el contenido de un archivo dentro del workspace local de forma hermética.',
      inputSchema: {
        type: 'object',
        properties: { filePath: { type: 'string' } },
        required: ['filePath']
      },
      outputSchema: {
        type: 'object',
        properties: { success: { type: 'boolean' }, content: { type: 'string' }, sizeBytes: { type: 'number' } },
        required: ['success', 'content']
      },
      handler: async (input) => {
        return {
          success: true,
          content: `// Contenido del archivo hermético: ${input.filePath}\n// Cargado correctamente en el kernel.`,
          sizeBytes: 154
        };
      }
    });

    // 2. Filesystem Write Tool
    this.register({
      id: 'CAP-004',
      name: 'desktop.fs.write',
      domain: 'desktop',
      execution: 'local',
      risk: 'medium',
      sensitivity: 'SECRET',
      description: 'Escribe de forma persistente un archivo de texto en el almacenamiento del host.',
      inputSchema: {
        type: 'object',
        properties: { filePath: { type: 'string' }, content: { type: 'string' } },
        required: ['filePath', 'content']
      },
      outputSchema: {
        type: 'object',
        properties: { success: { type: 'boolean' }, bytesWritten: { type: 'number' } },
        required: ['success']
      },
      handler: async (input) => {
        return {
          success: true,
          bytesWritten: input.content.length
        };
      }
    });

    // 3. Terminal Execution Sandbox
    this.register({
      id: 'CAP-010',
      name: 'desktop.terminal.execute',
      domain: 'desktop',
      execution: 'local',
      risk: 'high',
      sensitivity: 'INTERNAL',
      description: 'Ejecuta un comando en la shell local (ej: npm run build, pytest) de forma aislada.',
      inputSchema: {
        type: 'object',
        properties: { command: { type: 'string' }, timeoutMs: { type: 'number' } },
        required: ['command']
      },
      outputSchema: {
        type: 'object',
        properties: { exitCode: { type: 'number' }, stdout: { type: 'string' }, stderr: { type: 'string' } },
        required: ['exitCode']
      },
      handler: async (input) => {
        // Safe terminal execution simulator
        const cmd = input.command.trim();
        if (cmd.includes('rm -rf') || cmd.includes('format')) {
          throw new Error('Sovereign Sandbox Veto: El comando contiene secuencias destructivas prohibidas.');
        }

        if (cmd.startsWith('npm run test') || cmd.startsWith('vitest')) {
          return {
            exitCode: 0,
            stdout: '✓ All 12 sovereign test suites completed successfully. Coverage: 100%.',
            stderr: ''
          };
        }

        if (cmd.startsWith('npm run build') || cmd.startsWith('vite build')) {
          return {
            exitCode: 0,
            stdout: '✓ Production build generated in ./dist/ correctly (ESM format).',
            stderr: ''
          };
        }

        return {
          exitCode: 0,
          stdout: `[SANDBOX] Ejecutado comando: ${cmd}\nExit Code: 0 (OK)`,
          stderr: ''
        };
      }
    });

    // 4. Secure Clipboard Tool
    this.register({
      id: 'CAP-011',
      name: 'desktop.clipboard.interact',
      domain: 'desktop',
      execution: 'local',
      risk: 'low',
      sensitivity: 'PRIVATE',
      description: 'Lee o escribe información confidencial en el portapapeles local.',
      inputSchema: {
        type: 'object',
        properties: { action: { type: 'string', enum: ['read', 'write'] }, payload: { type: 'string' } },
        required: ['action']
      },
      outputSchema: {
        type: 'object',
        properties: { success: { type: 'boolean' }, data: { type: 'string' } },
        required: ['success']
      },
      handler: async (input) => {
        if (input.action === 'read') {
          return { success: true, data: 'sk_live_51NABC123456789_from_clipboard' };
        } else {
          return { success: true, data: input.payload || '' };
        }
      }
    });
  }

  public register(tool: ToolManifest) {
    if (this.registeredTools.has(tool.name)) {
      throw new Error(`La herramienta [${tool.name}] ya está registrada en el DesktopAgent.`);
    }
    this.registeredTools.set(tool.name, tool);
  }

  public getTool(name: string): ToolManifest | undefined {
    return this.registeredTools.get(name);
  }

  public listTools(): ToolManifest[] {
    return Array.from(this.registeredTools.values());
  }
}

// ==========================================
// SECTION III: MEMORY AGENT ARCHITECTURE
// ==========================================

export interface KnowledgeTriplet {
  subject: string;
  predicate: string;
  object: string;
  correlationId: string;
}

export interface SemanticVector {
  text: string;
  embedding: number[];
  metadata: Record<string, any>;
}

export class MemoryAgent {
  private sqliteGraphStore: KnowledgeTriplet[] = [];
  private vectorVault: SemanticVector[] = [];

  constructor() {
    this.seedDefaultKnowledge();
  }

  private seedDefaultKnowledge() {
    this.sqliteGraphStore.push(
      { subject: 'Aglaia OS', predicate: 'utilizes', object: 'Sovereign Event Bus', correlationId: 'system-init' },
      { subject: 'Sovereign Event Bus', predicate: 'guarantees', object: 'Determinismo Estricto', correlationId: 'system-init' },
      { subject: 'Permission Engine', predicate: 'shields', object: 'Local Workspace', correlationId: 'system-init' },
      { subject: 'DesktopAgent', predicate: 'interactsWith', object: 'Physical Host', correlationId: 'system-init' }
    );

    // Build deterministic character-frequency embeddings for simple local semantic vector matching!
    this.vectorVault.push(
      {
        text: "Directiva de Saneamiento: Eliminar claves privadas sk_live y contraseñas de logs antes de red remota.",
        embedding: this.calculateCharFrequencyEmbedding("Directiva de Saneamiento: Eliminar claves privadas sk_live y contraseñas de logs antes de red remota."),
        metadata: { category: "security", sensitivity: "CRITICAL" }
      },
      {
        text: "Regla del Kernel: La GPU local se prioriza para indexación vectorial y cálculos locales herméticos de ONNX.",
        embedding: this.calculateCharFrequencyEmbedding("Regla del Kernel: La GPU local se prioriza para indexación vectorial y cálculos locales herméticos de ONNX."),
        metadata: { category: "hardware", sensitivity: "INTERNAL" }
      },
      {
        text: "Protocolo de Red: Toda consulta al mundo celestial exterior debe sanitizarse reduciendo la precisión de rutas.",
        embedding: this.calculateCharFrequencyEmbedding("Protocolo de Red: Toda consulta al mundo celestial exterior debe sanitizarse reduciendo la precisión de rutas."),
        metadata: { category: "network", sensitivity: "PRIVATE" }
      }
    );
  }

  // Real client-side Vector calculations using letter frequency embeddings (L2 Normalized)
  private calculateCharFrequencyEmbedding(text: string): number[] {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const counts = new Array(chars.length).fill(0);
    const cleanText = text.toLowerCase();
    
    for (let i = 0; i < cleanText.length; i++) {
      const idx = chars.indexOf(cleanText[i]);
      if (idx !== -1) {
        counts[idx]++;
      }
    }

    // L2 Normalize
    const magnitude = Math.sqrt(counts.reduce((sum, val) => sum + val * val, 0)) || 1;
    return counts.map(val => val / magnitude);
  }

  // Cosine Similarity between two L2-normalized vectors is just their dot product!
  public calculateCosineSimilarity(v1: number[], v2: number[]): number {
    let dotProduct = 0;
    const len = Math.min(v1.length, v2.length);
    for (let i = 0; i < len; i++) {
      dotProduct += v1[i] * v2[i];
    }
    return dotProduct;
  }

  // Write a semantic triplet to the virtual SQLite ledger
  public writeTriplet(subject: string, predicate: string, object: string, correlationId: string): KnowledgeTriplet {
    const entry: KnowledgeTriplet = { subject, predicate, object, correlationId };
    this.sqliteGraphStore.push(entry);
    return entry;
  }

  // Read matching triplets from SQLite graph
  public queryGraph(subjectQuery?: string, predicateQuery?: string): KnowledgeTriplet[] {
    return this.sqliteGraphStore.filter(entry => {
      if (subjectQuery && !entry.subject.toLowerCase().includes(subjectQuery.toLowerCase())) return false;
      if (predicateQuery && !entry.predicate.toLowerCase().includes(predicateQuery.toLowerCase())) return false;
      return true;
    });
  }

  // Query Local Vector database using real cosine distance calculation
  public queryVectorVault(queryText: string, threshold = 0.5): { text: string; similarity: number; metadata: any }[] {
    const queryEmbedding = this.calculateCharFrequencyEmbedding(queryText);
    
    return this.vectorVault
      .map(entry => {
        const similarity = this.calculateCosineSimilarity(queryEmbedding, entry.embedding);
        return { text: entry.text, similarity, metadata: entry.metadata };
      })
      .filter(item => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity);
  }

  // Add new vector fact dynamically
  public insertVectorFact(text: string, metadata: Record<string, any> = {}): SemanticVector {
    const newVector: SemanticVector = {
      text,
      embedding: this.calculateCharFrequencyEmbedding(text),
      metadata
    };
    this.vectorVault.push(newVector);
    return newVector;
  }

  public getGraphStore(): KnowledgeTriplet[] {
    return this.sqliteGraphStore;
  }

  public getVectorVault(): SemanticVector[] {
    return this.vectorVault;
  }
}

// ==========================================
// SECTION IV: PLANNER / REASONER LOOP
// ==========================================

export interface ReasonerStep {
  id: string;
  capabilityName: string;
  input: Record<string, any>;
  status: 'pending' | 'awaiting_confirmation' | 'executing' | 'observed_success' | 'observed_error' | 'replanned';
  observation?: string;
  correlationId: string;
}

export class ReasonerEngine {
  private activeQueue: ReasonerStep[] = [];
  private executionHistory: { step: ReasonerStep; durationMs: number; error?: string }[] = [];

  constructor(
    private eventBus: SovereignEventBus,
    private desktopAgent: DesktopAgent,
    private memoryAgent: MemoryAgent,
    private permissionEngine?: PermissionEngine
  ) {}

  /**
   * Genera el plan de ejecución inicial traduciendo el objetivo a un DAG lineal o ramificado
   */
  public generatePlan(goal: string, sessionId: string): ReasonerStep[] {
    const goalLower = goal.toLowerCase();
    const correlationId = `corr-reasoner-${Math.floor(Math.random() * 1000)}`;

    if (goalLower.includes('auditar') || goalLower.includes('cve') || goalLower.includes('seguridad')) {
      this.activeQueue = [
        {
          id: 'step-read-config',
          capabilityName: 'desktop.fs.read',
          input: { filePath: './package.json' },
          status: 'pending',
          correlationId
        },
        {
          id: 'step-scan-clipboard',
          capabilityName: 'desktop.clipboard.interact',
          input: { action: 'read' },
          status: 'pending',
          correlationId
        },
        {
          id: 'step-execute-audit-command',
          capabilityName: 'desktop.terminal.execute',
          input: { command: 'npm run test:security' },
          status: 'pending',
          correlationId
        }
      ];
    } else {
      this.activeQueue = [
        {
          id: 'step-diagnose',
          capabilityName: 'desktop.fs.read',
          input: { filePath: './src/App.tsx' },
          status: 'pending',
          correlationId
        },
        {
          id: 'step-terminal-run',
          capabilityName: 'desktop.terminal.execute',
          input: { command: 'npm run build' },
          status: 'pending',
          correlationId
        }
      ];
    }

    return [...this.activeQueue];
  }

  /**
   * Executes the cognitive loop step by step, intercepting calls through PermissionEngine
   * and implementing dynamic re-planning on errors
   */
  public async executeNextStep(
    context: ExecutionContext,
    onStepUpdate: (logs: string[]) => void,
    onQueueSync?: (queue: ReasonerStep[]) => void
  ): Promise<'completed' | 're-planned_on_error' | 'permission_denied' | 'idle'> {
    const nextStep = this.activeQueue.find(s => s.status === 'pending');
    if (!nextStep) return 'idle';

    const stepIndex = this.activeQueue.indexOf(nextStep);
    const logs: string[] = [];
    logs.push(`⚙️ [REASONER LOOP] Iniciando paso '${nextStep.id}' - Capacidad: ${nextStep.capabilityName}`);
    onStepUpdate([...logs]);

    // Lookup physical capability tool from the registry
    const tool = this.desktopAgent.getTool(nextStep.capabilityName);
    if (!tool) {
      nextStep.status = 'observed_error';
      nextStep.observation = `La capacidad [${nextStep.capabilityName}] no está inscrita en el registro soberano local.`;
      logs.push(`❌ [REASONER ERROR] Capacidad faltante. Abortando.`);
      onStepUpdate([...logs]);
      onQueueSync?.([...this.activeQueue]);
      return 'idle';
    }

    // Intercept call via PermissionEngine when attached
    if (this.permissionEngine) {
      const evaluation = this.permissionEngine.evaluateStepRisk(tool, nextStep.input);
      if (evaluation.requiresConfirmation) {
        nextStep.status = 'awaiting_confirmation';
        onQueueSync?.([...this.activeQueue]);
        onStepUpdate([
          `⏸️ [PERMISSION ENGINE] Riesgo ${evaluation.effectiveRisk.toUpperCase()} detectado en '${tool.name}'. Pausando SovereignEventBus hasta obtener confirmación explícita del usuario...`
        ]);
      }

      const interception = await this.permissionEngine.interceptCall({
        taskId: context.taskId,
        stepIndex,
        stepId: nextStep.id,
        tool,
        input: nextStep.input,
      });

      if (!interception.allowed) {
        const isPolicyBlock = interception.resolvedBy === 'policy_blocked';
        const denialMsg =
          interception.denialReason ||
          (isPolicyBlock
            ? 'Operación bloqueada automáticamente por política configurable.'
            : 'Ejecución denegada por el usuario en SovereignEventBus.');
        nextStep.status = 'observed_error';
        nextStep.observation = `${isPolicyBlock ? 'BLOQUEO DE POLÍTICA' : 'VETO DE PERMISOS'} (${interception.evaluation.effectiveRisk.toUpperCase()}): ${denialMsg}`;
        this.executionHistory.push({
          step: { ...nextStep },
          durationMs: interception.waitDurationMs,
          error: denialMsg,
        });
        this.memoryAgent.writeTriplet(
          nextStep.id,
          isPolicyBlock ? 'blocked_by_policy_for' : 'permission_denied_for',
          tool.name,
          nextStep.correlationId
        );
        this.eventBus.emit({
          type: 'execution:step_failed',
          payload: { taskId: context.taskId, stepIndex, error: denialMsg },
        });
        onStepUpdate([
          isPolicyBlock
            ? `🛡️ [POLICY BLOCKED] ${nextStep.id} vetado por política (${interception.evaluation.policyRuleTriggered || 'policy'}): ${denialMsg}`
            : `🚫 [PERMISSION DENIED] ${nextStep.id} cancelado tras ${interception.waitDurationMs}ms: ${denialMsg}`,
        ]);
        onQueueSync?.([...this.activeQueue]);
        return 'permission_denied';
      }

      if (interception.waitedForUser) {
        onStepUpdate([`🔓 [PERMISSION GRANTED] Confirmación explícita recibida (${interception.waitDurationMs}ms). Reanudando ejecución de '${tool.name}'.`]);
      }
    }

    nextStep.status = 'executing';
    onQueueSync?.([...this.activeQueue]);

    this.eventBus.emit({
      type: 'execution:step_started',
      payload: { taskId: context.taskId, stepIndex, tool: tool.name, action: nextStep.id },
    });

    const start = Date.now();
    try {
      // Simulate physical handler execution
      const result = await tool.handler(nextStep.input, context);
      const duration = Date.now() - start;

      nextStep.status = 'observed_success';
      nextStep.observation = JSON.stringify(result);
      
      this.executionHistory.push({ step: { ...nextStep }, durationMs: duration });
      onStepUpdate([
        `✓ [OBSERVACIÓN EXITOSA] ${nextStep.id} culminado en ${duration}ms.`,
        `↳ Output: ${JSON.stringify(result)}`
      ]);

      // Write results semantically to the Memory SQLite Ledger
      this.memoryAgent.writeTriplet(
        nextStep.id,
        'observed_success_with',
        tool.name,
        nextStep.correlationId
      );

      this.eventBus.emit({
        type: 'execution:step_completed',
        payload: { taskId: context.taskId, stepIndex, observation: result }
      });

      onQueueSync?.([...this.activeQueue]);
      return 'completed';

    } catch (err: any) {
      const duration = Date.now() - start;
      nextStep.status = 'observed_error';
      nextStep.observation = err.message;
      
      this.executionHistory.push({ step: { ...nextStep }, durationMs: duration, error: err.message });
      logs.push(`⚠️ [FALLO DETECTADO] Paso '${nextStep.id}' arrojó un error operacional: ${err.message}`);
      
      // TRIGGER RE-PLANNER (Dynamic alteration of remaining nodes)
      logs.push(`⚖️ [RE-PLANIFICADOR ACTIVO] Analizando error. Alterando dinámicamente la cola restante.`);
      
      this.memoryAgent.writeTriplet(
        nextStep.id,
        'triggered_error',
        err.message,
        nextStep.correlationId
      );

      // Dynamically prepend a patch or security sanitation node in front of the queue to self-heal
      const autoHealNode: ReasonerStep = {
        id: `auto-heal-patch-${Math.floor(Math.random() * 100)}`,
        capabilityName: 'desktop.fs.write',
        input: { filePath: './src/remediation.ts', content: `// Safe auto-healing patch for error: ${err.message}` },
        status: 'pending',
        correlationId: nextStep.correlationId
      };

      // Prepend to current active queue
      const currentIndex = this.activeQueue.indexOf(nextStep);
      this.activeQueue.splice(currentIndex + 1, 0, autoHealNode);
      
      logs.push(`🔱 [COGNITIVE HEAL] Insertado paso correctivo dinámico '${autoHealNode.id}' (${autoHealNode.capabilityName}) para subsanar el fallo.`);
      
      this.eventBus.emit({
        type: 'execution:step_failed',
        payload: { taskId: context.taskId, stepIndex: currentIndex, error: err.message }
      });

      onStepUpdate([...logs]);
      return 're-planned_on_error';
    }
  }

  public getQueue(): ReasonerStep[] {
    return this.activeQueue;
  }

  public getHistory() {
    return this.executionHistory;
  }
}
