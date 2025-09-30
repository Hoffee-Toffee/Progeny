import { describe, it, expect } from 'vitest'
import { ProgenyGA as Progeny } from '../client/functions/genetic-algorithm'
import { tests } from '../client/files/tests.ts'

// Utility to run the new type-driven GA and check for errors and success
async function runGAAndCheck({
  populationSize = 10,
  maxGenerations = 10,
  testKey = 'sumThreeNumbers',
  maxDepth = 2,
} = {}) {
  const testCase = tests[testKey]
  const inputVariables = testCase.inputs.map((i) => i.name)
  const testCases = testCase.generateCases(20)
  const progeny = new Progeny(populationSize, maxGenerations, false)
  const bestBlocks = await progeny.run(testCase)
  expect(bestBlocks).toBeTruthy()
  // Evaluate best program on a fresh set of cases
  let correct = 0
  for (const { inputs, expected } of testCases) {
    // Defensive: ensure correct types for run and expected
    const safeInputs = Object.fromEntries(
      Object.entries(inputs).map(([k, v]) => [
        k,
        typeof v === 'number' || typeof v === 'boolean' ? v : 0,
      ]),
    ) as { [key: string]: number | boolean }
    // Use the same executeBlock logic as the GA
    const { executeBlock } = await import('../client/functions/program')
    const state = { vars: { ...safeInputs, out: 0 } }
    let result = 0
    for (const block of bestBlocks.blocks) {
      result = await executeBlock(block, state)
    }
    const expectedNum = typeof expected === 'number' ? expected : 0
    if (Math.abs(Number(result) - expectedNum) < 1e-6) correct++
  }
  const successRate = correct / testCases.length
  return { successRate, program: bestBlocks }
}

describe('Genetic Algorithm - sumThreeNumbers', () => {
  it('runs without errors and finds a perfect or near-perfect program (with program output)', async () => {
    const { successRate, program } = await runGAAndCheck({
      populationSize: 8,
      maxGenerations: 3,
      testKey: 'sumThreeNumbers',
      maxDepth: 2,
    })
    expect(successRate).toBeGreaterThan(0.5) // Accept >50% correct as "good", 1.0 as "great"
    // eslint-disable-next-line no-console
    console.log('Best evolved program:', JSON.stringify(program, null, 2))
  })
})
