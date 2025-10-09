import fs from 'fs'
import { describe, it, expect } from 'vitest'
import { Progeny } from '../client/functions/genetic-algorithm'
import { tests } from '../client/files/tests.ts'

// Utility to run the new type-driven GA and check for errors and success
async function runGAAndCheck({
  populationSize = 10,
  maxGenerations = 10,
  testKey = 'sumThreeNumbers',
  maxDepth = 2,
  trials = 1,
  evaluationCasesCount = 20,
  numEvaluationBatches = 1,
  consoleLog = false,
} = {}) {
  const testCase = tests[testKey]
  const inputVariables = testCase.inputs.map((i) => i.name)
  const testCases = testCase.generateCases(evaluationCasesCount)
  const progeny = new Progeny(
    populationSize,
    maxGenerations,
    consoleLog,
    evaluationCasesCount,
    numEvaluationBatches,
  )
  const bestBlocks = await progeny.run(testCase, trials)
  expect(bestBlocks).toBeTruthy()
  // Evaluate the final fitness score of the best evolved program
  let error = 0
  for (const { inputs, expected } of testCases) {
    let result = 0
    if (typeof bestBlocks.run === 'function') {
      result = await bestBlocks.run(inputs)
    } else if (Array.isArray(bestBlocks)) {
      const { executeBlock } = await import('../client/functions/program')
      const state = { vars: { ...inputs, out: 0 } }
      for (const block of bestBlocks) {
        result = await executeBlock(block, state)
      }
    }
    error += Math.abs(Number(result) - Number(expected))
  }
  const fitness = 1 / (1 + error)
  return { fitness, program: bestBlocks }
}

describe('Genetic Algorithm - sumThreeNumbers', () => {
  it('runs without errors and finds a perfect or near-perfect program (with program output)', async () => {
    const { fitness, program } = await runGAAndCheck({
      populationSize: 100,
      maxGenerations: 50,
      testKey: 'sumThreeNumbers',
      trials: 1,
      evaluationCasesCount: 20,
      numEvaluationBatches: 1,
      consoleLog: false,
    })
    // eslint-disable-next-line no-console
    console.log('Best evolved program:', JSON.stringify(program, null, 2))
    const logData = {
      fitness,
      program: program && program.blocks ? program.blocks : program,
    }
    fs.writeFileSync('progeny_test_log.json', JSON.stringify(logData, null, 2))
    expect(fitness).toBeGreaterThan(0.5) // Accept >0.5 as "good", 1.0 as "great"
  })
})
