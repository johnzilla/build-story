export interface GitSource {
  /** Get the ISO date string of the most recent commit touching this file, or null if not in git */
  getFileDate(relativePath: string): Promise<string | null>
  /** Get all tags with their dates and messages */
  getTags(): Promise<Array<{ name: string; date: string; message: string }>>
}
