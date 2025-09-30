// --- Subtree utilities for mutation/crossover ---
function collectSubBlocks(block: Block, parent: Block | null = null, index: number | null = null, path: Array<{ block: Block, parent: Block | null, index: number | null }> = []): Array<{ block: Block, parent: Block | null, index: number | null }> {
  path.push({ block, parent, index });
  if (Array.isArray(block.inputs)) {
    block.inputs.forEach((input, i) => {
      if (input && typeof input === 'object' && 'blockName' in input) {
        collectSubBlocks(input as Block, block, i, path);
      }
    });
  }
  return path;
}

function replaceSubBlock(root: Block, target: Block, replacement: Block): Block {
  if (root === target) return replacement;
  if (!Array.isArray(root.inputs)) return root;
  const newInputs = root.inputs.map((input) => {
    if (input === target) return replacement;
    if (input && typeof input === 'object' && 'blockName' in input) {
      return replaceSubBlock(input as Block, target, replacement);
    }
    return input;
  });
  return { ...root, inputs: newInputs };
}
// Direct JS-to-TS conversion of genetic-algorithm.js (first pass)

// Imports will be updated in the next step for correct types and APIs

import { log, logBestProgram } from './logger'
import { generateInput, ProgenyProgram } from './program'
import type { Block } from '../files/blocks'
import type { TestProblem } from '../files/tests'

const DEFAULT_EVALUATION_CASES = 20
const DEFAULT_NUM_EVAL_BATCHES = 1

export class ProgenyGA {
  populationSize: number
  maxGenerations: number
  consoleLog: boolean
  evaluationCasesCount: number
  numEvaluationBatches: number
  population: ProgenyProgram[]

  constructor(
    populationSize = 100,
    maxGenerations = 50,
    consoleLog = false,
    evaluationCasesCount = DEFAULT_EVALUATION_CASES,
    numEvaluationBatches = DEFAULT_NUM_EVAL_BATCHES,
  ) {
    this.populationSize = populationSize
    this.maxGenerations = maxGenerations
    this.consoleLog = consoleLog
    this.evaluationCasesCount = evaluationCasesCount
    this.numEvaluationBatches = numEvaluationBatches
    this.population = []
  }

  // Initialize population with random block programs using dynamic block selection
  async initialize(testInputs: { name: string; type: string }[]) {
    const inputVars = testInputs.map((i) => i.name)
    const programPromises = Array.from({ length: this.populationSize }, () => {
      // Dynamically generate a valid value expression for set_number using block output types
      const valueExpr = generateInput('number', inputVars, 0, 2) as
        | string
        | number
        | boolean
        | import('../files/blocks').Block
      const setBlock = {
        blockName: 'set_number',
        inputs: ['out', valueExpr],
      }
      const getBlock = {
        blockName: 'get_number',
        inputs: ['out'],
      }
      // Optionally, add more statements or randomize block order for diversity
      return ProgenyProgram.create(
        [setBlock, getBlock],
        testInputs,
        this.consoleLog,
      )
    })
    this.population = await Promise.all(programPromises)
    const avgLength =
      this.population.reduce((sum, p) => sum + p.blocks.length, 0) /
      this.population.length
    await log(
      `Initial population: ${
        this.population.length
      } programs, avg length: ${avgLength.toFixed(2)} blocks`,
      this.consoleLog,
    )
  }

  // Evaluate fitness of a program (array of blocks)
  async evaluate(
    program: ProgenyProgram,
    testCase: TestProblem<Record<string, unknown>, unknown>,
  ): Promise<number> {
    let error = 0
    const cases = testCase.generateCases(this.evaluationCasesCount)
    for (const { inputs, expected } of cases) {
      const result = await program.run(inputs)
      if (typeof result !== 'number') {
        await log(`Non-numeric output: ${result}`, this.consoleLog)
        return 0
      }
      error += Math.abs(result - (expected as number))
    }
    return 1 / (1 + error)
  }

  // Select top programs
  async select(testCase: TestProblem<Record<string, unknown>, unknown>) {
    if (this.population.length === 0) {
      await log('Select: Population is empty, cannot select.', this.consoleLog)
      return
    }
    // 1. Evaluate all programs and store fitness (averaged over batches)
    const evaluatedPopulation = await Promise.all(
      this.population.map(async (program) => {
        let totalFitnessScore = 0
        let actualBatchesRun = 0
        for (let i = 0; i < this.numEvaluationBatches; i++) {
          const singleBatchFitness = await this.evaluate(program, testCase)
          totalFitnessScore += singleBatchFitness
          actualBatchesRun++
        }
        const averageFitness =
          actualBatchesRun > 0 ? totalFitnessScore / actualBatchesRun : 0
        return { program, fitness: averageFitness }
      }),
    )
    // 2. Sort based on stored fitness (descending)
    evaluatedPopulation.sort((a, b) => b.fitness - a.fitness)
    // 3. Log the best program of this entire generation (before truncation)
    if (evaluatedPopulation.length > 0) {
      const bestProgramOfGeneration = evaluatedPopulation[0].program
      const bestFitnessOfGeneration = evaluatedPopulation[0].fitness
      const programJson = JSON.stringify(bestProgramOfGeneration.blocks)
      await logBestProgram(programJson, this.consoleLog)
      await log(
        `Gen Best Fitness: ${bestFitnessOfGeneration.toFixed(
          4,
        )} (program logged to best_programs.log)`,
        this.consoleLog,
      )
    }
    // 4. Truncate to form the new parent pool for this.population
    const selectionSize = Math.floor(this.populationSize / 2)
    const selectedSurvivors = evaluatedPopulation.slice(0, selectionSize)
    this.population = selectedSurvivors.map((item) => item.program)
    if (this.population.length > 0) {
      const bestSurvivorFitness = await this.evaluate(
        this.population[0],
        testCase,
      )
      await log(
        `Select: Kept ${
          this.population.length
        } survivors. Best survivor fitness: ${bestSurvivorFitness.toFixed(4)}`,
        this.consoleLog,
      )
    } else {
      await log('Select: No survivors after selection.', this.consoleLog)
    }
  }

  // Crossover two programs (block arrays) with subtree crossover
  async crossover(
    program1: ProgenyProgram,
    program2: ProgenyProgram,
  ): Promise<ProgenyProgram> {
    const p1_blocks = program1.blocks;
    const p2_blocks = program2.blocks;
    const inputVariables = program1.inputVariables;
    // Defensive: fallback to random if both are empty
    if (p1_blocks.length === 0 && p2_blocks.length === 0) {
      return ProgenyProgram.create(
        [],
        inputVariables.map((name) => ({ name, type: 'number' })),
        this.consoleLog,
      );
    }
    if (p1_blocks.length === 0)
      return new ProgenyProgram(
        JSON.parse(JSON.stringify(p2_blocks)),
        inputVariables,
        this.consoleLog,
      );
    if (p2_blocks.length === 0)
      return new ProgenyProgram(
        JSON.parse(JSON.stringify(p1_blocks)),
        inputVariables,
        this.consoleLog,
      );
    // Subtree crossover: pick a random block from each parent and swap subtrees
    // Only operate on the value input of set_number for now (main expression tree)
    const setBlock1 = p1_blocks.find(b => b.blockName === 'set_number');
    const setBlock2 = p2_blocks.find(b => b.blockName === 'set_number');
    if (!setBlock1 || !setBlock2 || !Array.isArray(setBlock1.inputs) || !Array.isArray(setBlock2.inputs) || setBlock1.inputs.length < 2 || setBlock2.inputs.length < 2) {
      // Fallback to top-level crossover
      return new ProgenyProgram(JSON.parse(JSON.stringify(p1_blocks)), inputVariables, this.consoleLog);
    }
    const expr1 = setBlock1.inputs[1] as Block;
    const expr2 = setBlock2.inputs[1] as Block;
    // Collect all sub-blocks (including root)
    const subBlocks1 = collectSubBlocks(expr1);
    const subBlocks2 = collectSubBlocks(expr2);
    // Pick random subtree from each
    const pick1 = subBlocks1[Math.floor(Math.random() * subBlocks1.length)];
    const pick2 = subBlocks2[Math.floor(Math.random() * subBlocks2.length)];
    // Swap subtrees
    const newExpr1 = replaceSubBlock(expr1, pick1.block, pick2.block);
    // Build new child program
    const childSetBlock = { ...setBlock1, inputs: [setBlock1.inputs[0], newExpr1] };
    const getBlock = p1_blocks.find(b => b.blockName === 'get_number') || { blockName: 'get_number', inputs: ['out'] };
    const childBlocks = [childSetBlock, getBlock];
    return new ProgenyProgram(childBlocks, inputVariables, this.consoleLog);
  }

  // Run the genetic algorithm
  async run(
    testCase: TestProblem<Record<string, unknown>, unknown>,
    trials = 10,
  ): Promise<ProgenyProgram> {
    let bestProgram: ProgenyProgram | null = null
    let bestFitness = -Infinity
    for (let trial = 0; trial < trials; trial++) {
      await log(`Trial ${trial + 1}/${trials}`, this.consoleLog)
      await this.initialize(testCase.inputs)
      for (let gen = 0; gen < this.maxGenerations; gen++) {
        await log(
          `Generation ${gen + 1}/${this.maxGenerations}`,
          this.consoleLog,
        )
        await this.select(testCase)
        if (this.population.length === 0) {
          if (gen < this.maxGenerations - 1) {
            await this.initialize(testCase.inputs)
            if (this.population.length === 0) break
          } else {
            break
          }
        }
        const newPopulation: ProgenyProgram[] = []
        const numElites = 1
        for (let i = 0; i < numElites && i < this.population.length; i++) {
          newPopulation.push(this.population[i])
        }
        const parentPool = this.population
        while (newPopulation.length < this.populationSize) {
          if (parentPool.length === 0) break
          const parent1 =
            parentPool[Math.floor(Math.random() * parentPool.length)]
          const parent2 =
            this.population[Math.floor(Math.random() * this.population.length)]
          const child = await this.crossover(parent1, parent2)
          // Subtree mutation: with some probability, replace a random subtree in the main expression
          if (Math.random() < 0.3) {
            const setBlock = child.blocks.find(b => b.blockName === 'set_number');
            if (setBlock && setBlock.inputs && setBlock.inputs.length > 1) {
              const expr = setBlock.inputs[1] as Block;
              const subBlocks = collectSubBlocks(expr);
              const pick = subBlocks[Math.floor(Math.random() * subBlocks.length)];
              const newSubtree = generateInput('number', testCase.inputs.map(i => i.name), 0, 2) as Block;
              const newExpr = replaceSubBlock(expr, pick.block, newSubtree);
              setBlock.inputs[1] = newExpr;
            }
          }
          newPopulation.push(child)
        }
        this.population = newPopulation
      }
      const trialBest = this.population[0]
      const trialFitness = await this.evaluate(trialBest, testCase)
      if (trialFitness > bestFitness) {
        bestFitness = trialFitness
        bestProgram = trialBest
      }
    }
    await log(
      `Best Program (Fitness: ${bestFitness.toFixed(4)}):\n${JSON.stringify(
        bestProgram?.blocks,
        null,
        2,
      )}`,
      this.consoleLog,
    )
    if (bestProgram) return bestProgram
    // Fallback: return a trivial program if none found
    return new ProgenyProgram(
      [
        { blockName: 'set_number', inputs: ['out', 0] },
        { blockName: 'get_number', inputs: ['out'] },
      ],
      [],
      this.consoleLog,
    )
  }
}
