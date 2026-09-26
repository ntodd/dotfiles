import React from "react"
import {AbsoluteFill} from "remotion"
import {C} from "../theme"
import {phrase, type SceneInfo} from "../data"
import {Words} from "../components/Words"
import type {Cue} from "../cues"

// A starter scene: a big line that rises word by word as the narrator says
// it, and an optional subline on the next phrase.
//   on_screen: {headline: "Send a link. Get back the *original.*", sub: "..."}
// Wrap words in *asterisks* for the accent color.
export function statementCues(s: SceneInfo): Cue[] {
  return [{t: Math.max(0, phrase(s, 0).start - 0.15), sfx: "whoosh-short", volume: 0.3}]
}

export const Statement: React.FC<{s: SceneInfo}> = ({s}) => {
  const headline = s.on_screen?.headline ?? s.vo?.text ?? ""
  const sub = s.on_screen?.sub
  const ink = s.dark ? "#fff" : C.ink
  return (
    <AbsoluteFill style={{alignItems: "center", justifyContent: "center", padding: "0 160px", gap: 36}}>
      <Words at={phrase(s, 0).start - 0.1} size={96} weight={650} color={ink}>
        {headline}
      </Words>
      {sub ? (
        <Words at={phrase(s, 1).start - 0.1} size={44} weight={500} color={s.dark ? C.studioInk2 : C.ink2}>
          {sub}
        </Words>
      ) : null}
    </AbsoluteFill>
  )
}
