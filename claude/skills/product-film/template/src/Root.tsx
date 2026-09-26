import React from "react"
import {Composition} from "remotion"
import {Main} from "./Main"
import {timeline} from "./data"

export const Root: React.FC = () => (
  <>
    <Composition
      id="Film"
      component={Main}
      durationInFrames={timeline.durationInFrames}
      fps={timeline.fps}
      width={timeline.width}
      height={timeline.height}
      defaultProps={{captions: false}}
    />
    <Composition
      id="FilmCaptioned"
      component={Main}
      durationInFrames={timeline.durationInFrames}
      fps={timeline.fps}
      width={timeline.width}
      height={timeline.height}
      defaultProps={{captions: true}}
    />
  </>
)
