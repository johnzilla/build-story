import { EditorialOptionsSchema, type EditorialOptions } from '@buildstory/core'

export interface EditorialFlags {
  question?: string
  pivotalEvents?: string[]
  targetRuntime?: string
}

/** Flags override individual config fields, including an explicit empty ID list. */
export function resolveEditorial(config: EditorialOptions | undefined, flags: EditorialFlags): EditorialOptions | undefined {
  if (!config && flags.question === undefined && flags.pivotalEvents === undefined && flags.targetRuntime === undefined) return undefined
  return EditorialOptionsSchema.parse({
    ...config,
    ...(flags.question !== undefined ? { centralQuestion: flags.question } : {}),
    ...(flags.pivotalEvents !== undefined ? { pivotalEventIds: flags.pivotalEvents } : {}),
    ...(flags.targetRuntime !== undefined ? { targetRuntimeSeconds: /^\d+$/.test(flags.targetRuntime) ? Number(flags.targetRuntime) : NaN } : {}),
  })
}
