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

  it('真下のブロックは掘るだけで、進むのは重力に任せる', () => {
    expect(decideAction(grid, 1, 1, 'down')).toEqual({ kind: 'dig', x: 1, y: 2, enter: false })
  })

  it('横のブロックは掘りながらそのマスへ入る', () => {
    expect(decideAction(grid, 1, 2, 'right')).toEqual({ kind: 'dig', x: 2, y: 2, enter: true })
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

  it('真上のブロックは掘れるが、登りはしない', () => {
    expect(decideAction(grid, 1, 2, 'up')).toEqual({ kind: 'dig', x: 1, y: 1, enter: false })
  })
})
