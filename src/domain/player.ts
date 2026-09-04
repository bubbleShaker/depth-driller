import type { Grid } from './grid'
import { DIRECTION_DELTA, type Direction } from './types'

export type PlayerAction =
  | { kind: 'none' }
  /** 壊す。左右なら壊しながらそのマスへ入る */
  | { kind: 'dig'; x: number; y: number; enter: boolean }
  | { kind: 'move'; x: number; y: number }

/**
 * その方向を押したら何が起きるかを決める。
 *
 * 左右は壊すのと入るのが 1 手。別々にすると横へ進むのに倍の時間がかかり、
 * 頭上のブロックが落ちてくるまでに逃げ切れない。
 * 上下に空きがあっても自分では動かない。登る手段は無いし、降りるのは重力の仕事。
 */
export function decideAction(grid: Grid, x: number, y: number, dir: Direction): PlayerAction {
  const { dx, dy } = DIRECTION_DELTA[dir]
  const tx = x + dx
  const ty = y + dy

  if (grid.isWall(tx) || ty < 0) return { kind: 'none' }
  const sideways = dir === 'left' || dir === 'right'
  if (grid.at(tx, ty) !== null) return { kind: 'dig', x: tx, y: ty, enter: sideways }
  if (sideways) return { kind: 'move', x: tx, y: ty }
  return { kind: 'none' }
}
