// Sound cues. Scenes return them in scene-local seconds; Main offsets them
// onto the timeline. A cue plays an effect from public/sfx, or a slice of
// any file in public (src + from + duration), optionally ducking the music.
export type Cue = {
  t: number
  sfx?: string
  src?: string
  from?: number
  duration?: number
  volume?: number
  duck?: boolean
}
