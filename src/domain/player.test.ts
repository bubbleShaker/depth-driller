import { describe, expect, it } from 'vitest'
import { decideAction } from './player'
import { makeGrid } from './testing'

describe('decideAction', () => {
  const grid = makeGrid([
    '........', //
    '.1......',
    '11111111',
    '11111111',
  ])

  it('ブロックがあれば掘る', () => {
    expect(decideAction(grid, 1, 1, 'down')).toEqual({ kind: 'dig', x: 1, y: 2 })
  })

  it('空いていれば横に歩く', () => {
    expect(decideAction(grid, 1, 1, 'right')).toEqual({ kind: 'move', x: 2, y: 1 })
  })

  it('壁の外へは何もできない', () => {
    expect(decideAction(grid, 0, 1, 'left')).toEqual({ kind: 'none' })
  })

  it('地表より上へは出られない', () => {
    expect(decideAction(grid, 1, 0, 'up')).toEqual({ kind: 'none' })
  })

  it('上下に空きがあっても自分では動かない（登れないし、降りるのは重力の仕事）', () => {
    expect(decideAction(grid, 1, 1, 'up')).toEqual({ kind: 'none' })
  })

  it('真上のブロックは掘れる', () => {
    expect(decideAction(grid, 1, 2, 'up')).toEqual({ kind: 'dig', x: 1, y: 1 })
  })
})
