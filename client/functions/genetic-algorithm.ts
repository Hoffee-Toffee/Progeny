import { ProgenyProgram, optimizeDeadStores } from './program'
import { tests, TestProblem } from '../files/tests'
import blocks from '../files/blocks'
import { log, logBestProgram } from './logger'

const defaultNumericValue = 0
const DEFAULT_EVALUATION_CASES = 100
const DEFAULT_NUM_EVAL_BATCHES = 5 // Increased from 1 for less noise

export class Progeny {
  populationSize: number
  maxGenerations: number
  consoleLog: boolean
  evaluationCasesCount: number
  numEvaluationBatches: number
  population: ProgenyProgram[]

  constructor(
    populationSize = 200,
    maxGenerations = 100,
    consoleLog = false,
    evaluationCasesCount = DEFAULT_EVALUATION_CASES,
    numEvaluationBatches = DEFAULT_NUM_EVAL_BATCHES,
  ) {
    this.populationSize = populationSize
    this.maxGenerations = maxGenerations
    this.consoleLog = consoleLog
    this.evaluationCasesCount = evaluationCasesCount
    this.numEvaluationBatches = numEvaluationBatches || DEFAULT_NUM_EVAL_BATCHES
    this.population = []
  }

  // Initialize population (diverse random programs)
  async initialize(testInputs: any): Promise<void> {
    const inputVariableNames = testInputs.map((i: any) => i.name)
    const programPromises = Array.from(
      { length: this.populationSize },
      async () => {
        const randomBlocks: import('../files/blocks').Block[] = []
        const numInitialBlocks = Math.floor(Math.random() * 21) + 5 // 5-25 blocks for variety
        for (let j = 0; j < numInitialBlocks; j++) {
          const randomBlock = await ProgenyProgram.generateRandomBlock(
            0, // depth
            5, // maxDepth increased for complexity
            false,
            null,
            inputVariableNames, // inputVariables
            this.consoleLog,
          )
          randomBlocks.push(randomBlock)
        }
        randomBlocks.push({ blockName: 'return', inputs: ['out'] })
        return new ProgenyProgram(
          randomBlocks,
          inputVariableNames,
          this.consoleLog,
        )
      },
    )
    this.population = await Promise.all(programPromises)
    const avgLength =
      this.population.reduce((sum, p) => sum + p.blocks.length, 0) /
      this.population.length
    await log(
      `Initial population: ${this.population.length} programs, avg length: ${avgLength.toFixed(2)} blocks`,
      this.consoleLog,
    )
  }

  // Evaluate fitness
  async evaluate(
    program: ProgenyProgram,
    testCase: TestProblem<unknown, unknown>,
    cases?: any[],
  ): Promise<number> {
    let error = 0
    const evaluationCases =
      cases || testCase.generateCases(this.evaluationCasesCount)
    for (const { inputs, expected } of evaluationCases) {
      const result = await program.run(inputs)
      if (typeof result !== 'number') {
        await log(`Non-numeric output: ${result}`, this.consoleLog)
        return 0
      }
      error += Math.abs(result - expected)
    }
    const fitness = 1 / (1 + error)
    return fitness
  }

  // Select top programs
  async select(testCase: TestProblem<unknown, unknown>): Promise<void> {
    if (this.population.length === 0) {
      await log('Select: Population is empty, cannot select.', this.consoleLog)
      return
    }

    // 1. Evaluate all programs and store fitness (averaged over batches)
    const cases = testCase.generateCases(this.evaluationCasesCount)
    const evaluatedPopulation = await Promise.all(
      this.population.map(async (program) => {
        let totalFitnessScore = 0
        let actualBatchesRun = 0
        if (this.numEvaluationBatches <= 0) {
          this.numEvaluationBatches = 1
        }
        for (let i = 0; i < this.numEvaluationBatches; i++) {
          const singleBatchFitness = await this.evaluate(program, testCase, cases)
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
        `Gen Best Fitness: ${bestFitnessOfGeneration.toFixed(4)} (program logged to best_programs.log)`,
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
        `Select: Kept ${this.population.length} survivors. Best survivor fitness: ${bestSurvivorFitness.toFixed(4)}`,
        this.consoleLog,
      )
    } else {
      await log('Select: No survivors after selection.', this.consoleLog)
    }
  }

  // Crossover two programs - One-point crossover for block lists
  async crossover(
    program1: ProgenyProgram,
    program2: ProgenyProgram,
  ): Promise<ProgenyProgram> {
    const p1_blocks = program1.blocks
    const p2_blocks = program2.blocks
    const inputVariables = program1.inputVariables
    if (p1_blocks.length === 0 && p2_blocks.length === 0) {
      await log(
        'Crossover: Both parents empty, creating default program for child.',
        this.consoleLog,
      )
      return ProgenyProgram.create([], inputVariables, this.consoleLog, [])
    }
    if (p1_blocks.length === 0) {
      await log(
        'Crossover: Parent 1 empty, cloning Parent 2 for child.',
        this.consoleLog,
      )
      return new ProgenyProgram(
        JSON.parse(JSON.stringify(p2_blocks)),
        inputVariables,
        this.consoleLog,
        [program2.id],
      )
    }
    if (p2_blocks.length === 0) {
      await log(
        'Crossover: Parent 2 empty, cloning Parent 1 for child.',
        this.consoleLog,
      )
      return new ProgenyProgram(
        JSON.parse(JSON.stringify(p1_blocks)),
        inputVariables,
        this.consoleLog,
        [program1.id],
      )
    }
    const cp1 = Math.floor(Math.random() * (p1_blocks.length + 1))
    const cp2 = Math.floor(Math.random() * (p2_blocks.length + 1))
    const segment1 = JSON.parse(JSON.stringify(p1_blocks.slice(0, cp1)))
    const segment2 = JSON.parse(JSON.stringify(p2_blocks.slice(cp2)))
    const raw_child_blocks = segment1.concat(segment2)
    let non_return_blocks = raw_child_blocks.filter(
      (block: any) => block.blockName !== 'return',
    )
    const MAX_BLOCKS = 20
    if (non_return_blocks.length > MAX_BLOCKS) {
      await log(
        `Crossover: Child program too long (${non_return_blocks.length} blocks), truncating to ${MAX_BLOCKS}.`,
        this.consoleLog,
      )
      non_return_blocks = non_return_blocks.slice(0, MAX_BLOCKS)
    }
    const final_child_blocks = non_return_blocks.concat([
      { blockName: 'return', inputs: ['out'] },
    ])
    const childProgram = new ProgenyProgram(
      final_child_blocks,
      inputVariables,
      this.consoleLog,
      [program1.id, program2.id],
    )
    childProgram.blocks = optimizeDeadStores(
      childProgram.blocks,
      inputVariables,
      this.consoleLog,
    )
    return childProgram
  }

  // Run the genetic algorithm (batched eval, always mutate, log new pop best)
  async run(
    testCase: TestProblem<any, any>,
    trials = 10,
  ): Promise<ProgenyProgram | null> {
    let bestProgram: ProgenyProgram | null = null
    let bestFitness = -Infinity

    for (let trial = 0; trial < trials; trial++) {
      await log(`Trial ${trial + 1}/${trials}`, this.consoleLog)
      await this.initialize(testCase.inputs)
      const cases = testCase.generateCases(this.evaluationCasesCount)
      for (let gen = 0; gen < this.maxGenerations; gen++) {
        // Batched evaluation for accuracy
        const evaluatedPopulation = await Promise.all(
          this.population.map(async (program) => {
            let totalFitness = 0
            for (let i = 0; i < this.numEvaluationBatches; i++) {
              totalFitness += await this.evaluate(program, testCase, cases)
            }
            return {
              program,
              fitness: totalFitness / this.numEvaluationBatches,
            }
          }),
        )
        evaluatedPopulation.sort((a, b) => b.fitness - a.fitness)

        const numElites = 1
        const elites = evaluatedPopulation
          .slice(0, numElites)
          .map((pf) => pf.program)
        const survivors = evaluatedPopulation
          .slice(0, Math.floor(this.populationSize / 2))
          .map((pf) => pf.program)

        const newPopulation: ProgenyProgram[] = [...elites]
        while (newPopulation.length < this.populationSize) {
          const parent1 =
            survivors[Math.floor(Math.random() * survivors.length)]
          const parent2 =
            survivors[Math.floor(Math.random() * survivors.length)]
          const child = await this.crossover(parent1, parent2)
          if (Math.random() < 0.3) {
            await child.mutate()
          }
          newPopulation.push(child)
        }
        this.population = newPopulation

        // Log best of NEW population
        const newFitnesses = await Promise.all(
          newPopulation.map((p) => this.evaluate(p, testCase, cases)),
        )
        const bestNewFitness = Math.max(...newFitnesses)
        await log(
          `Gen ${gen + 1}: Best fitness: ${bestNewFitness.toFixed(4)}`,
          this.consoleLog,
        )
      }
      // After all generations, evaluate best in final population
      const fitnesses = await Promise.all(
        this.population.map((program) => this.evaluate(program, testCase, cases)),
      )
      const popWithFitness = this.population.map((program, i) => ({
        program,
        fitness: fitnesses[i],
      }))
      popWithFitness.sort((a, b) => b.fitness - a.fitness)

      await log(`Top 3 programs for trial ${trial + 1}:`, this.consoleLog)
      for (let i = 0; i < Math.min(3, popWithFitness.length); i++) {
        const { program, fitness } = popWithFitness[i]
        const error = fitness > 0 ? 1 / fitness - 1 : Infinity
        await log(
          `  ${i + 1}. Fitness: ${fitness.toFixed(4)}, Error: ${error.toFixed(4)}\n    Blocks: ${JSON.stringify(program.blocks, null, 2)}`,
          this.consoleLog,
        )
      }

      if (popWithFitness.length > 0) {
        const trialBest = popWithFitness[0].program
        const trialFitness = popWithFitness[0].fitness
        if (trialFitness > bestFitness) {
          bestFitness = trialFitness
          bestProgram = trialBest
        }
      }
    }
    await log(
      `Best Program Overall (Fitness: ${bestFitness.toFixed(4)}):\n${JSON.stringify(bestProgram?.blocks, null, 2)}`,
      this.consoleLog,
    )
    return bestProgram
  }
}
