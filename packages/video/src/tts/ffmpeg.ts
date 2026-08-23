// Central resolution for the ffmpeg / ffprobe binaries.
//
// BuildStory relies on a system FFmpeg install (documented in README Requirements
// and checked in preflight). We do NOT bundle ffmpeg-static: it ships only
// `ffmpeg` (not `ffprobe`, which we need for audio-duration measurement), and a
// ~60MB bundled binary is poor value for a developer CLI whose users already have
// FFmpeg. Both paths are overridable via env vars for users with a custom build.

export function getFfmpegPath(): string {
  return process.env['FFMPEG_PATH'] ?? 'ffmpeg'
}

export function getFfprobePath(): string {
  return process.env['FFPROBE_PATH'] ?? 'ffprobe'
}
