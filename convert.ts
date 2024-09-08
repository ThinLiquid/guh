import fs from 'fs/promises'
import { BeatmapDecoder } from 'osu-parsers'

const decoder = new BeatmapDecoder()

const newConvert = async (path: string) => {
  const chart = await decoder.decodeFromPath(path)
  const notes = chart.hitObjects.map(hitObject => {
    return ({
      lane: (hitObject.startX - 64) / 128,
      time: hitObject.startTime,
      hold: hitObject.endTime - hitObject.startTime
    })
  })
  return notes
}

const data = await newConvert('./public/Street - Hestia (guden) [Intermediate].osu')

fs.writeFile('./public/notes.json', JSON.stringify(data))