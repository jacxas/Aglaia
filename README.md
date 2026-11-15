# Aglaia 🏛️

> Interfaz de IA de alta elegancia: un asistente con voz propia, herramientas reales y un motor de permisos que decide qué puede ejecutar y qué no.

Aglaia no es otro chat. Es una consola: responde con tono de conserje aristocrático, guarda notas, calcula, consulta la actualidad con Google Search y **audita cada acción** a través de su `PermissionEngine`.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 · Vite 6 · Tailwind 4 · motion · d3 · Recharts |
| Backend | Express (`server.ts`) · `@google/genai` (Gemini) |
| Datos | SQLite (`sqlite3`) |
| Permisos | `src/PermissionEngine.ts` — riesgo `low→critical` con decisión `allow / confirm / block` |

## Arranque rápido

```bash
git clone https://github.com/jacxas/Aglaia.git
cd Aglaia
npm install

# clave de Gemini (Google AI Studio → API key)
cp .env.example .env
#   GEMINI_API_KEY=AIza...

npm run dev
# → http://localhost:3000
```

Producción:

```bash
npm run build
npm start
```

## Qué incluye

- **Persona Aglaia**: tono cortesano, sin emojis, respuestas breves y definitivas (definida en `server.ts`, fácil de cambiar).
- **Herramientas reales**: notas persistentes (SQLite), matemática, estado interno y **búsqueda en vivo** vía Google Search.
- **PermissionEngine**: clasifica cada llamada por riesgo, detecta credenciales y comandos destructivos, y puede exigir confirmación humana antes de ejecutar.
- **Observabilidad**: `AgentAnalyticsDashboard`, `AgentLogTimeline`, `MicrokernelVisualizer`, `TaskQueuePanel` y `SqliteTableBrowser` para ver qué hizo el agente y por qué.

## Estructura

```
server.ts                 API + Gemini + registro de tools
src/
  App.tsx                 shell de la interfaz
  PermissionEngine.ts     política de riesgos y confirmaciones
  orbiter.ts              núcleo de ejecución de herramientas
  orbiter_kernel.ts       bus de eventos y tipos
  db.ts                   SQLite (notas, logs)
  logAnalytics.ts         analítica de ejecuciones
  components/             15 paneles (analytics, kernel, permisos, SQL…)
metadata.json             manifiesto de app (export de AI Studio Build)
```

## Estado

Prototipo funcional. Origen: export de **Google AI Studio Build**, reordenado y documentado por JACXAS.
Pendiente para producto: tests automatizados, autenticación multiusuario, rate limiting, empaquetado de escritorio y landing pública.

## Licencia

MIT © 2026 JACXAS — ver [LICENSE](./LICENSE).
