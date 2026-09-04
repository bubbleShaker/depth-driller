/** 十字ボタンで入る 4 方向。斜めは無い */
export type Direction = 'up' | 'down' | 'left' | 'right'

/** ブロックの色数。色は見た目ではなくルールの一部で、同色 4 つ以上がつながると消える */
export const COLOR_COUNT = 5

export type Cell = {
  color: number
  /** 直前の落下ティックで 1 マス落ちた。描画側が「落ちてくる途中」を補間するのに使う */
  fell: boolean
} | null

export const DIRECTION_DELTA: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
}
