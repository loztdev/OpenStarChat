/** OpenAI-format tool definitions shipped with the app (safe, local execution only). */
export const BUILTIN_OPENROUTER_TOOLS: unknown[] = [
  {
    type: 'function',
    function: {
      name: 'get_current_datetime',
      description:
        'Returns the current date and time from the user device (ISO-8601 and unix milliseconds).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_random_int',
      description: 'Returns a random integer between min and max (inclusive).',
      parameters: {
        type: 'object',
        properties: {
          min: { type: 'integer', description: 'Lower bound (inclusive)' },
          max: { type: 'integer', description: 'Upper bound (inclusive)' },
        },
        required: ['min', 'max'],
      },
    },
  },
]

const SAFE_TOOL_NAMES = new Set(['get_current_datetime', 'get_random_int'])

export function isBuiltinToolName(name: string): boolean {
  return SAFE_TOOL_NAMES.has(name)
}

export function runBuiltinTool(name: string, argsJson: string): string {
  try {
    if (name === 'get_current_datetime') {
      return JSON.stringify({
        iso: new Date().toISOString(),
        unix_ms: Date.now(),
      })
    }
    if (name === 'get_random_int') {
      const args = JSON.parse(argsJson || '{}') as { min?: number; max?: number }
      let min = Number(args.min ?? 0)
      let max = Number(args.max ?? 10)
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return JSON.stringify({ error: 'min and max must be numbers' })
      }
      if (min > max) [min, max] = [max, min]
      const lo = Math.ceil(min)
      const hi = Math.floor(max)
      if (hi < lo) return JSON.stringify({ error: 'invalid_range' })
      const value = Math.floor(Math.random() * (hi - lo + 1)) + lo
      return JSON.stringify({ value })
    }
  } catch (e) {
    return JSON.stringify({ error: String(e) })
  }
  return JSON.stringify({ error: `unknown_tool:${name}` })
}

export type ToolCallAccumulator = Map<
  number,
  { id?: string; name: string; arguments: string }
>

export function mergeToolCallDeltas(
  acc: ToolCallAccumulator,
  deltas: Array<{
    index?: number
    id?: string
    function?: { name?: string; arguments?: string }
  }>,
): void {
  for (const d of deltas) {
    const idx = typeof d.index === 'number' ? d.index : 0
    const cur = acc.get(idx) ?? { name: '', arguments: '' }
    if (d.id) cur.id = d.id
    if (d.function?.name) cur.name += d.function.name
    if (d.function?.arguments) cur.arguments += d.function.arguments
    acc.set(idx, cur)
  }
}

export function accumulatorToOpenAIToolCalls(
  acc: ToolCallAccumulator,
): Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> {
  return [...acc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => ({
      id: v.id ?? `call_${Math.random().toString(36).slice(2, 10)}`,
      type: 'function' as const,
      function: { name: v.name, arguments: v.arguments || '{}' },
    }))
    .filter((c) => c.function.name)
}
