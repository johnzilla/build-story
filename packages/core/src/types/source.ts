export interface ArtifactSource {
  readFile(path: string): Promise<string>
  glob(patterns: string[], options?: { cwd?: string; ignore?: string[] }): Promise<string[]>
}
