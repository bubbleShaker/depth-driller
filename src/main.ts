import './style.css'
import { Game } from './domain/game'
import type { Direction } from './domain/types'
import { Controls } from './input/controls'
import { Renderer } from './render/renderer'

/** タブを離れて戻ってきた時に、溜まった時間で一気に落ちて即死しないようにする */
const MAX_FRAME_MS = 100

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (element === null) throw new Error(`${selector} が見つからない`)
  return element
}

const canvas = required<HTMLCanvasElement>('#board')
const stage = required<HTMLElement>('#stage')
const pad = required<HTMLElement>('#pad')
const depthLabel = required<HTMLElement>('#depth')
const finalDepthLabel = required<HTMLElement>('#final-depth')
const overlay = required<HTMLElement>('#overlay')
const retryButton = required<HTMLButtonElement>('#retry')

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right']
const padKeys = new Map<Direction, HTMLElement>()
for (const key of document.querySelectorAll<HTMLElement>('[data-dir]')) {
  // dataset は string なので、素通しでキャストせず既知の 4 方向に照合する
  const dir = DIRECTIONS.find((d) => d === key.dataset['dir'])
  if (dir !== undefined) padKeys.set(dir, key)
}

const renderer = new Renderer(canvas)
const controls = new Controls()
controls.attachPad(pad)
controls.attachKeyboard(window)

let game = new Game()

function layout(): void {
  const rect = stage.getBoundingClientRect()
  renderer.resize(rect.width, rect.height)
}
window.addEventListener('resize', layout)
window.addEventListener('orientationchange', layout)
layout()

function restart(): void {
  game = new Game()
  controls.reset()
  overlay.hidden = true
}
retryButton.addEventListener('click', restart)

let shownDepth = -1
let shownGameover = false
let lastFrame = performance.now()

function frame(now: number): void {
  const dt = Math.min(now - lastFrame, MAX_FRAME_MS)
  lastFrame = now

  const direction = controls.direction
  game.update(dt, direction)
  renderer.draw(game)

  // DOM は変わった時だけ触る。毎フレーム書き換えるとレイアウトが走る
  if (game.maxDepth !== shownDepth) {
    shownDepth = game.maxDepth
    depthLabel.textContent = String(shownDepth)
  }
  const isGameover = game.state === 'gameover'
  if (isGameover !== shownGameover) {
    shownGameover = isGameover
    overlay.hidden = !isGameover
    finalDepthLabel.textContent = String(game.maxDepth)
  }
  for (const [dir, key] of padKeys) {
    key.classList.toggle('is-active', dir === direction)
  }

  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
