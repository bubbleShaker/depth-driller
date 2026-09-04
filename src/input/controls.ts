import type { Direction } from '../domain/types'

const KEY_MAP: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
}

/** 十字の真ん中。ここに指があるうちは何も押していない扱いにする */
const DEAD_ZONE_RATIO = 0.16

/**
 * 押されている方向を 1 つだけ持つ。
 *
 * 十字ボタンは 4 つの要素に分けず、パッド全体で指の位置を見て方向を決めている。
 * ボタンごとに分けると、指を滑らせて方向を変えた時に一度離す必要が出てしまい、
 * 掘る方向を素早く変える遊びと噛み合わない。
 */
export class Controls {
  #direction: Direction | null = null
  #pointerId: number | null = null
  #keys = new Set<Direction>()
  /** キーボードで最後に押された方向。掘る対象は 1 つなので、後から押した方を優先する */
  #lastKey: Direction | null = null

  get direction(): Direction | null {
    return this.#direction ?? this.#lastKey
  }

  attachPad(pad: HTMLElement): void {
    const update = (event: PointerEvent) => {
      const rect = pad.getBoundingClientRect()
      const dx = event.clientX - (rect.left + rect.width / 2)
      const dy = event.clientY - (rect.top + rect.height / 2)
      const dead = Math.min(rect.width, rect.height) * DEAD_ZONE_RATIO
      if (Math.hypot(dx, dy) < dead) {
        this.#direction = null
        return
      }
      this.#direction =
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
    }

    pad.addEventListener('pointerdown', (event) => {
      if (this.#pointerId !== null) return
      this.#pointerId = event.pointerId
      // 指がパッドの外へ出ても離すまで追い続ける
      pad.setPointerCapture(event.pointerId)
      update(event)
    })
    pad.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.#pointerId) return
      update(event)
    })
    const release = (event: PointerEvent) => {
      if (event.pointerId !== this.#pointerId) return
      this.#pointerId = null
      this.#direction = null
    }
    pad.addEventListener('pointerup', release)
    pad.addEventListener('pointercancel', release)
  }

  attachKeyboard(target: Window): void {
    target.addEventListener('keydown', (event) => {
      const dir = KEY_MAP[event.code]
      if (dir === undefined) return
      event.preventDefault()
      this.#keys.add(dir)
      this.#lastKey = dir
    })
    target.addEventListener('keyup', (event) => {
      const dir = KEY_MAP[event.code]
      if (dir === undefined) return
      this.#keys.delete(dir)
      // 離したのが最後に押したキーなら、まだ押されている方向に戻す
      if (this.#lastKey === dir) this.#lastKey = [...this.#keys].at(-1) ?? null
    })
    target.addEventListener('blur', () => this.#clearKeys())
  }

  /** 押しっぱなしの状態を消す。ゲームをやり直す時に持ち越さないため */
  reset(): void {
    this.#direction = null
    this.#pointerId = null
    this.#clearKeys()
  }

  #clearKeys(): void {
    this.#keys.clear()
    this.#lastKey = null
  }
}
