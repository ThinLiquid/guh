import { Application, Graphics } from 'pixi.js';
import { BeatmapDecoder } from 'osu-parsers'
// @ts-expect-error
import { ManiaRuleset } from 'osu-mania-stable';
import * as zip from "@zip.js/zip.js";

const perfectTiming = 16;
const greatTiming = 64 - 3;
const goodTiming = 97 - 3;
const okTiming = 127 - 3;
const mehTiming = 151 - 3;
const missTiming = 161 - 3;

const laneWidth = 150;
const numLanes = 4;

(async () => {

const app = new Application();
await app.init({ backgroundAlpha: 0, resizeTo: window });
document.body.appendChild(app.canvas);

const lanes: Graphics[] = [];

const playfieldWidth = laneWidth * numLanes;
const playfieldStartX = (app.screen.width - playfieldWidth) / 2;

for (let i = 0; i < numLanes; i++) {
  const lane = new Graphics();
  lane.rect(0, 0, laneWidth, app.screen.height).fill('black');
  lane.x = playfieldStartX + i * laneWidth;
  lanes.push(lane);
  app.stage.addChild(lane);
}

interface Note {
  lane: number;
  time: number;
  hold: number;
  note: Graphics;
  holdNote: Graphics | null;
  hit: boolean;
  holding: boolean;
  releaseTime: number | null;
}

let combo = 0;



let totalTravelTime = 15
const travelTime = Math.round(11485 / totalTravelTime)

window.addEventListener('keydown', (e) => {
  // listen for the 3 and 4 key and change the speed
  if (e.key === '4') {
    totalTravelTime++
    createJudgement(`speed level ${totalTravelTime}`)
  } else if (e.key === '3') {
    totalTravelTime--
    createJudgement(`speed level ${totalTravelTime}`)
  }
})

const judgeLine = new Graphics();
judgeLine.rect(playfieldStartX, 0, playfieldWidth, 3).fill(0xffffff);
judgeLine.y = app.screen.height - 50;
app.stage.addChild(judgeLine);

const laneKeys = {
  'a': 0,
  's': 1,
  'k': 2,
  'l': 3
};

const keyState: { [key: string]: boolean } = {};

const start = async () => {
  createJudgement('loading...')
  const chart = await importMap((document.querySelector('#file') as HTMLInputElement).files![0]);
  await new Promise(resolve => setTimeout(resolve, 1000));
  let notes: Note[] = chart.map(({ lane, time, hold }: {
    lane: number,
    time: number,
    hold: number
  }) => {
    const note = new Graphics();
    note.rect(0, 0, laneWidth, 20).fill(0xffffff);
    note.x = playfieldStartX + lane * laneWidth;
    note.y = judgeLine.y - (time / travelTime) * app.screen.height;
    app.stage.addChild(note);
  
    let holdNote = null;
    if (hold > 0) {
      holdNote = new Graphics();
      const holdHeight = (hold / travelTime) * app.renderer.height;
      holdNote.rect(0, 0, laneWidth, holdHeight).fill(0x00ff00);
      holdNote.x = playfieldStartX + lane * laneWidth;
      holdNote.y = note.y - holdHeight;
      app.stage.addChild(holdNote);
    }
  
    return {
      note,
      holdNote,
      lane,
      time,
      hold,
      hit: false,
      holding: false,
      releaseTime: hold > 0 ? time + hold : null,
    };
  });

  const removeNote = (note: Note) => {
    app.stage.removeChild(note.note);
    if (note.holdNote) {
      app.stage.removeChild(note.holdNote);
    }
    notes = notes.filter(n => n !== note);
  }

  await new Audio(audioUrl).play();
  const startTime = Date.now();

  app.ticker.add(({ deltaMS }) => {
    const currentTime = Date.now() - startTime;

    notes.forEach(note => {
      if (note.hit && !note.holdNote) return;

      note.note.y += (deltaMS / travelTime) * app.screen.height;
      if (note.holdNote) {
        if (note.holding && currentTime >= note.time) {
          note.holdNote.height -= (deltaMS / travelTime) * app.screen.height * (note.holding ? 1 : 0.5);
          note.holdNote.y = judgeLine.y - note.holdNote.height;
        } else {
          note.holdNote.y += (deltaMS / travelTime) * app.screen.height;
        }
      }

      if (note.note.y > app.screen.height + 20 && !note.holding) {
        if (!note.hit) {
          console.log('Missed note');
          combo = 0;
          createJudgement('Miss');
        }
        removeNote(note);
      } else if (note.holdNote && note.holding && currentTime >= note.releaseTime!) {
        console.log('Hold note completed');
        removeNote(note);
      }
    });

    // Check for held keys
    Object.entries(laneKeys).forEach(([key, lane]) => {
      if (keyState[key]) {
        const heldNote = notes.find(note => note.lane === lane && note.holding);
        if (heldNote) {
          highlightLane(lane);
        }
      }
    });
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    const { key } = e;
    if (keyState[key]) return; // Prevent key repeat
    keyState[key] = true;
  
    const lane = laneKeys[key as keyof typeof laneKeys];
    if (lane === undefined) return;
  
    highlightLane(lane);
  
    const currentTime = Date.now() - startTime;
    const hitNote = notes.find(note => {
      if (note.hit) return false;
      const noteTime = note.time;
      const timeDiff = Math.abs(currentTime - noteTime);
      return note.lane === lane && timeDiff < missTiming;
    });
  
    if (!hitNote) return;
  
    const timeDiff = Math.abs(currentTime - hitNote.time);
    let score;
  
    if (timeDiff < perfectTiming) score = 320;
    else if (timeDiff < greatTiming) score = 300;
    else if (timeDiff < goodTiming) score = 200;
    else if (timeDiff < okTiming) score = 100;
    else if (timeDiff < mehTiming) score = 50;
    else score = 0;
  
    console.log(`Hit note at lane ${hitNote.lane} with score ${score}`);
    createJudgement(score.toString());
    combo++;
  
    hitNote.hit = true;
  
    if (hitNote.hold > 0) {
      hitNote.holding = true;
      hitNote.note.alpha = 0
    } else {
      removeNote(hitNote);
    }
  }
  
  const handleKeyUp = (e: KeyboardEvent) => {
    const { key } = e;
    keyState[key] = false;
  
    const lane = laneKeys[key as keyof typeof laneKeys];
    if (lane === undefined) return;
  }

  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
}



const highlightLane = (laneIndex: number) => {
  const lane = lanes[laneIndex];
  lane.fill(0xffffff);

  setTimeout(() => {
    lane.fill(0x000000);
  }, 100);
}

(document.querySelector('#file') as HTMLInputElement).onchange = () => {
  (document.querySelector('#file') as HTMLInputElement).onchange = null;
  start();
}

const createJudgement = (text: string) => {
  const colorMap = {
    'Miss': 0xff0000,
    '50': 0xffa500,
    '100': 0xffff00,
    '200': 0x00ff00,
    '300': 0x00ffff,
    '320': 0xff00ff
  };

  document.body.style.setProperty('--random', Math.random().toString());
  document.body.style.setProperty('--rnd-positive-or-negative', Math.random() > 0.5 ? '1' : '-1');
  const element = document.createElement('div');
  element.innerText = text;
  element.style.position = 'absolute';
  element.style.top = '50%';
  element.style.left = '50%';
  element.style.transform = 'translate(-50%, -50%)';
  element.style.color = `#${(colorMap[text as keyof typeof colorMap] || 0x000000).toString(16)}`
  element.style.fontSize = '48px';
  element.classList.add('judgement');
  document.querySelector('#judgement')!.appendChild(element);

  document.getElementById('combo')!.innerText = `${combo}`;
}

let audioUrl = ''

const ruleset = new ManiaRuleset();


const decoder = new BeatmapDecoder()


const importMap = async (file: File) => {
  const reader = new zip.ZipReader(new zip.BlobReader(file));
  const entries = await reader.getEntries();

  let osuEntry = entries.filter(entry => entry.filename.endsWith('.osu'))

  let name = ''
  if (osuEntry.length > 1) {
    const osuFiles = (await Promise.all(osuEntry.map(async (entry, index)=> {
      const beatmap = await decoder.decodeFromString(await entry.getData!(new zip.TextWriter()))
      const difficulty = ruleset.createDifficultyCalculator(beatmap).calculate()
      if (index === 0) {
        name = `${beatmap.metadata.artist} - ${beatmap.metadata.title}`
      }
      return {
        name: `[${'⭐'.repeat(difficulty.starRating)}] ${beatmap.metadata.version}`,
        filename: entry.filename,
        difficulty: difficulty.starRating
      }
    }))).sort((a, b) => a.difficulty - b.difficulty).map(file => {
      return {
        name: file.name,
        filename: file.filename
      }
    })
    // give the user an index option list
    const _ = prompt(`${name}\n\n${osuFiles.map((file, index) => `${index + 1}: ${file.name}`).join('\n')}`)
    osuEntry = osuEntry.filter((entry) => entry.filename === osuFiles[parseInt(_!) - 1].filename)
  }

  console.log(osuEntry)
  
  const osuFile = await osuEntry[0].getData!(new zip.TextWriter())

  const chart = await decoder.decodeFromString(osuFile)
  
  const audioFile = chart.general.audioFilename
  const audioEntry = entries.find(entry => entry.filename === audioFile)
  const audioBlob = await audioEntry!.getData!(new zip.BlobWriter())
  audioUrl = URL.createObjectURL(audioBlob)

  const background = chart.events.backgroundPath
  const backgroundEntry = entries.find(entry => entry.filename === background)
  const backgroundBlob = await backgroundEntry!.getData!(new zip.BlobWriter())
  document.body.style.backgroundImage = `url(${URL.createObjectURL(backgroundBlob)})`

  return chart.hitObjects.map(hitObject => ({
    lane: (hitObject.startX - 64) / 128,
    time: hitObject.startTime,
    hold: (hitObject as any).endTime - hitObject.startTime
  }))
}

})()