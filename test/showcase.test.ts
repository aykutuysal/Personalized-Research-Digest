// test/showcase.test.ts
import { describe, it, expect } from 'vitest'
import { applyPatches } from '@/lib/ai/showcase'

describe('applyPatches', () => {
  const angles = [
    { id: 1, text: 'atrial fibrillation fundamentals' },
    { id: 2, text: 'catheter ablation outcomes' },
    { id: 3, text: 'cardiac MRI' },
    { id: 4, text: 'anticoagulation' },
    { id: 5, text: 'AI detection' },
    { id: 6, text: 'rhythm control' },
    { id: 7, text: 'genetics' },
    { id: 8, text: 'clinical outcomes' },
  ]

  it('returns angles unchanged when patches is empty', () => {
    expect(applyPatches(angles, [])).toEqual(angles)
  })

  it('removes absorbed angles and rewrites the merge target', () => {
    const patches = [
      {
        absorbedAngleId: 7,
        intoAngleId: 1,
        newText: 'atrial fibrillation fundamentals and genetic risk',
        reason: 'genetics overlap',
      },
    ]
    const result = applyPatches(angles, patches)
    expect(result).toHaveLength(7)
    expect(result.find((a) => a.text.includes('genetic risk'))).toBeDefined()
    expect(result.find((a) => a.text === 'genetics')).toBeUndefined()
  })

  it('re-sequences IDs from 1 after removing an angle', () => {
    const patches = [
      { absorbedAngleId: 3, intoAngleId: 2, newText: 'catheter ablation including imaging', reason: '' },
    ]
    const result = applyPatches(angles, patches)
    expect(result.map((a) => a.id)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('handles two patches in one call', () => {
    const patches = [
      { absorbedAngleId: 7, intoAngleId: 1, newText: 'AF and genetics', reason: '' },
      { absorbedAngleId: 6, intoAngleId: 2, newText: 'ablation and rhythm control', reason: '' },
    ]
    const result = applyPatches(angles, patches)
    expect(result).toHaveLength(6)
    expect(result.map((a) => a.id)).toEqual([1, 2, 3, 4, 5, 6])
  })
})
