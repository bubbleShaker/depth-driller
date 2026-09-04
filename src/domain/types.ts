/** 十字ボタンで入る 4 方向。斜めは無い */
export type Direction = 'up' | 'down' | 'left' | 'right'

/** ブロックの色数。色は見た目ではなくルールの一部で、同色 4 つ以上がつながると消える */
export const COLOR_COUNT = 4

export type Cell = {
  color: number
  /** 直前の落下ティックで 1 マス落ちた。描画側が「落ちてくる途中」を補間するのに使う */
  fell: boolean
  /**
   * 支えを失ってから何ティック浮いているか。
   * 支えを外した瞬間に落ちてくると、掘った本人には避ける手がない。
   * 原作と同じく一拍おいてから落とすための猶予で、その間ブロックは震えて予告する。
   */
  floatTicks: number
  /**
   * 消えるまでの残りティック。0 なら消える予定は無い。
   * 4 つ揃った瞬間に消すと何が起きたか分からないので、点滅する間だけ盤面に残す。
   * この間ブロックは落ちも消えもしない第 3 の状態にいる。
   */
  clearTicks: number
} | null

export const DIRECTION_DELTA: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
}
