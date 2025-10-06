export interface TestProblem<T, U> {
  name: string
  inputs: { name: string; type: 'number' | 'boolean' }[]
  generateCases: (count: number) => { inputs: T; expected: U }[]
}

export const tests: Record<string, TestProblem<any, any>> = {
  'Sum three numbers': {
    name: 'Sum three numbers',
    inputs: [
      { name: 'v0', type: 'number' },
      { name: 'v1', type: 'number' },
      { name: 'v2', type: 'number' },
    ],
    generateCases: (count: number) => {
      const cases = []
      for (let i = 0; i < count; i++) {
        const v0 = Math.random() * 10
        const v1 = Math.random() * 10
        const v2 = Math.random() * 10
        cases.push({
          inputs: { v0, v1, v2 },
          expected: v0 + v1 + v2,
        })
      }
      return cases
    },
  },
}