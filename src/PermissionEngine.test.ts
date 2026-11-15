import { describe, expect, it } from "vitest";
import { PermissionEngine, type InterceptCallTool } from "./PermissionEngine";
import type { SovereignEventBus } from "./orbiter_kernel";

const bus = {} as unknown as SovereignEventBus;
const engine = () => new PermissionEngine(bus);

const tool = (name: string, risk: InterceptCallTool["risk"], extra: Partial<InterceptCallTool> = {}): InterceptCallTool => ({
  id: `tool-${name}`,
  name,
  risk,
  ...extra,
});

describe("PermissionEngine.evaluateStepRisk", () => {
  it("permite herramientas de riesgo bajo con argumentos limpios", () => {
    const result = engine().evaluateStepRisk(tool("read_note", "low"), { id: 1 });
    expect(result.effectiveRisk).toBe("low");
    expect(result.decision).toBe("allow");
    expect(result.blockedByPolicy).toBe(false);
  });

  it("exige confirmación desde riesgo medio (política por defecto)", () => {
    const result = engine().evaluateStepRisk(tool("write_note", "medium"), { text: "hola" });
    expect(result.effectiveRisk).toBe("medium");
    expect(result.decision).toBe("require_confirmation");
    expect(result.requiresConfirmation).toBe(true);
  });

  it("bloquea herramientas vetadas explícitamente", () => {
    const e = engine();
    e.updatePolicy({ blockedTools: ["sovereign.wallet.transfer", "write_note"] });
    const result = e.evaluateStepRisk(tool("write_note", "low"), {});
    expect(result.decision).toBe("block");
    expect(result.policyRuleTriggered).toBe("blocked_tool_list");
  });

  it("bloquea patrones de input prohibidos (mkfs)", () => {
    const result = engine().evaluateStepRisk(tool("run_shell", "low"), { command: "mkfs.ext4 /dev/sda1" });
    expect(result.decision).toBe("block");
    expect(result.policyRuleTriggered).toBe("blocked_input_pattern");
  });

  it("escala comandos destructivos a critical y bloquea si la política lo pide", () => {
    const e = engine();
    e.updatePolicy({ blockDestructiveCommands: true });
    const result = e.evaluateStepRisk(tool("run_shell", "low"), { command: "rm -rf /tmp/x" });
    expect(result.effectiveRisk).toBe("critical");
    expect(result.blockedByPolicy).toBe(true);
    expect(result.policyRuleTriggered).toBe("block_destructive_commands");
    expect(result.matchedSignals).toContain("destructive_rm_rf");
  });

  it("detecta credenciales y bloquea con blockOnSecretLeakage", () => {
    const e = engine();
    e.updatePolicy({ blockOnSecretLeakage: true });
    const result = e.evaluateStepRisk(tool("write_note", "low"), {
      text: "mi clave es AIzaSyABCDEFGHIJKLMNOPQRSTUV123456789",
    });
    expect(result.effectiveRisk === "high" || result.effectiveRisk === "critical").toBe(true);
    expect(result.blockedByPolicy).toBe(true);
    expect(result.policyRuleTriggered).toBe("block_on_secret_leakage");
    expect(result.matchedSignals).toContain("google_api_key");
  });

  it("modo strictLocalOnly veta herramientas de red o navegador", () => {
    const e = engine();
    e.updatePolicy({ strictLocalOnly: true });
    const result = e.evaluateStepRisk(tool("web_search", "low", { domain: "network" }), { q: "clima" });
    expect(result.decision).toBe("block");
    expect(result.policyRuleTriggered).toBe("strict_local_only");
  });

  it("respeta trustedTools en riesgo medio", () => {
    const e = engine();
    e.updatePolicy({ trustedTools: ["write_note"] });
    const result = e.evaluateStepRisk(tool("write_note", "medium"), { text: "ok" });
    expect(result.decision).toBe("allow");
    expect(result.matchedSignals).not.toContain("always_confirm_policy");
  });

  it("alwaysConfirmTools fuerza confirmación aunque el riesgo sea bajo", () => {
    const e = engine();
    e.updatePolicy({ alwaysConfirmTools: ["read_note"] });
    const result = e.evaluateStepRisk(tool("read_note", "low"), {});
    expect(result.decision).toBe("require_confirmation");
    expect(result.matchedSignals).toContain("always_confirm_policy");
  });

  it("eleva a high el acceso a rutas protegidas del sistema", () => {
    const result = engine().evaluateStepRisk(tool("read_file", "low"), { path: "C:\\Windows\\win.ini" });
    expect(result.effectiveRisk).toBe("high");
    expect(result.matchedSignals).toContain("system_protected_path");
    expect(result.decision).toBe("require_confirmation");
  });
});
