// TypeScript version of tests.js with types for number, boolean, and future types

export type TestInputType = 'number' | 'boolean'

export interface TestInputDef {
  name: string
  type: TestInputType
}

export interface TestCase<I extends Record<string, unknown>, O> {
  inputs: I
  expected: O
}

export interface TestProblem<I extends Record<string, unknown>, O> {
  inputs: TestInputDef[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  target: (...args: any[]) => O
  generateCases: (numEvaluationCases: number) => TestCase<I, O>[]
}

export interface Tests {
  [key: string]: TestProblem<Record<string, unknown>, unknown>
}

export const tests: Tests = {
  sumThreeNumbers: {
    inputs: [
      { name: 'x', type: 'number' },
      { name: 'y', type: 'number' },
      { name: 'z', type: 'number' },
    ],
    target: (x: number, y: number, z: number) => x + y + z,
    generateCases: (numEvaluationCases: number) =>
      Array.from({ length: numEvaluationCases }, () => {
        const inputs = {
          x: Math.round(Math.random() * 20 - 10) / 1,
          y: Math.round(Math.random() * 20 - 10) / 1,
          z: Math.round(Math.random() * 20 - 10) / 1,
        }
        return { inputs, expected: inputs.x + inputs.y + inputs.z }
      }),
  },
  squareNumber: {
    inputs: [{ name: 'x', type: 'number' }],
    target: (x: number) => x * x,
    generateCases: (numEvaluationCases: number) =>
      Array.from({ length: numEvaluationCases }, () => {
        const inputs = {
          x: Math.round(Math.random() * 20 - 10) / 1,
        }
        return { inputs, expected: inputs.x * inputs.x }
      }),
  },
  multiplyBy4Subtract2: {
    inputs: [{ name: 'x', type: 'number' }],
    target: (x: number) => x * 4 - 2,
    generateCases: (numEvaluationCases: number) =>
      Array.from({ length: numEvaluationCases }, () => {
        const inputs = {
          x: Math.round(Math.random() * 20 - 10) / 1,
        }
        return { inputs, expected: inputs.x * 4 - 2 }
      }),
  },
  quadraticEquation: {
    inputs: [
      { name: 'x', type: 'number' },
      { name: 'y', type: 'number' },
      { name: 'z', type: 'number' },
    ],
    target: (x: number, a: number, b: number) => a * x * x + b * x,
    generateCases: (numEvaluationCases: number) =>
      Array.from({ length: numEvaluationCases }, () => {
        const inputs = {
          x: Math.round(Math.random() * 20 - 10) / 1,
          y: Math.round(Math.random() * 20 - 10) / 1,
          z: Math.round(Math.random() * 20 - 10) / 1,
        }
        return {
          inputs,
          expected: inputs.y * inputs.x * inputs.x + inputs.z * inputs.x,
        }
      }),
  },
  conditionalOutput: {
    inputs: [
      { name: 'x', type: 'number' },
      { name: 'y', type: 'number' },
    ],
    target: (x: number, y: number) =>
      [x - y, x + y, x * y].includes(3) ? 3 : 0,
    generateCases: (numEvaluationCases: number) =>
      Array.from({ length: numEvaluationCases }, () => {
        const inputs = {
          x: Math.round(Math.random() * 20 - 10) / 1,
          y: Math.round(Math.random() * 20 - 10) / 1,
        }
        return {
          inputs,
          expected: [
            inputs.x - inputs.y,
            inputs.x + inputs.y,
            inputs.x * inputs.y,
          ].includes(3)
            ? 3
            : 0,
        }
      }),
  },
  absoluteValue: {
    inputs: [{ name: 'x', type: 'number' }],
    target: (x: number) => Math.abs(x),
    generateCases: (numEvaluationCases: number) =>
      Array.from({ length: numEvaluationCases }, () => {
        const inputs = {
          x: Math.round(Math.random() * 20 - 10) / 1,
        }
        return { inputs, expected: Math.abs(inputs.x) }
      }),
  },
}
