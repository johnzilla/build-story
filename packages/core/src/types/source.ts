export interface ArtifactSource {
  readFile(path: string): Promise<string>
  glob(patterns: string[], options?: { cwd?: string; ignore?: string[] }): Promise<string[]>
  /** Resolve a relative reference from one file to another. Returns normalized relative path or null. */
  resolveRef?(fromPath: string, refUrl: string): string | null
  /** Get file modification time. Returns null if unavailable. */
  getMtime?(path: string): Promise<Date | null>
}
