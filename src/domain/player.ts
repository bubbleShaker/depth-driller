import type { Grid } from './grid'
import { DIRECTION_DELTA, type Direction } from './types'

export type PlayerAction =
  | { kind: 'none' }
  | { kind: 'dig'; x: number; y: number }
  | { kind: 'move'; x: number; y: number }

/**
 * その方向を押したら何が起きるかを決める。
 *
 * 「壊す」と「壊した穴に入る」を別の 1 手にしているのは原作と同じで、
 * 押しっぱなしなら壊す → 入る、と自然につながる。
 * 上下に空きがあっても自分では動かない。登る手段は無いし、降りるのは重力の仕事。
 */
export function decideAction(grid: Grid, x: number, y: number, dir: Direction): PlayerAction {
  const { dx, dy } = DIRECTION_DELTA[dir]
  const tx = x + dx
  const ty = y + dy

  if (grid.isWall(tx) || ty < 0) return { kind: 'none' }
  if (grid.at(tx, ty) !== null) return { kind: 'dig', x: tx, y: ty }
  if (dir === 'left' || dir === 'right') return { kind: 'move', x: tx, y: ty }
  return { kind: 'none' }
}
