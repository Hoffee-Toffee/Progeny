import { ProgenyProgram } from './program.ts'
import { tests } from './tests.ts'
import { log, warn, error, logBestProgram } from '../functions/logger.ts'
import type { Block } from './blocks.ts'

const defaultNumericValue = 0
const DEFAULT_EVALUATION_CASES = 20
const DEFAULT_NUM_EVAL_BATCHES = 1

interface TestCase {
  name: string
  inputs: string[]
  generateCases: (count: number) => { inputs: any; expected: any }[]
}

export class Progeny {
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

  async initialize(testInputs: string[]) {
    const programPromises = Array.from({ length: this.populationSize }, () =>
      ProgenyProgram.create([], testInputs, this.consoleLog),
    )
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

  async evaluate(
    program: ProgenyProgram,
    testCase: TestCase,
  ): Promise<number> {
    let errorSum = 0
    const cases = testCase.generateCases(this.evaluationCasesCount)
    for (const { inputs, expected } of cases) {
      const result = await program.run(inputs)
      if (typeof result !== 'number') {
        await log(`Non-numeric output: ${result}`, this.consoleLog)
        return 0
      }
      errorSum += Math.abs(result - expected)
    }
    const fitness = 1 / (1 + errorSum)
    return fitness
  }

  async select(testCase: TestCase) {
    if (this.population.length === 0) {
      await log('Select: Population is empty, cannot select.', this.consoleLog)
      return
    }

    const evaluatedPopulation = await Promise.all(
      this.population.map(async (program) => {
        let totalFitnessScore = 0
        let actualBatchesRun = 0
        if (this.numEvaluationBatches <= 0) {
          warn(
            `numEvaluationBatches is ${this.numEvaluationBatches}, defaulting to 1 for program evaluation.`,
            this.consoleLog,
          )
          this.numEvaluationBatches = 1
        }

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

    evaluatedPopulation.sort((a, b) => b.fitness - a.fitness)

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
      return ProgenyProgram.create([], inputVariables, this.consoleLog)
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
      )
    }

    const cp1 = Math.floor(Math.random() * (p1_blocks.length + 1))
    const cp2 = Math.floor(Math.random() * (p2_blocks.length + 1))

    const segment1 = JSON.parse(JSON.stringify(p1_blocks.slice(0, cp1)))
    const segment2 = JSON.parse(JSON.stringify(p2_blocks.slice(cp2)))

    let raw_child_blocks: Block[] = segment1.concat(segment2)

    let non_return_blocks = raw_child_blocks.filter(
      (block) => block.blockName !== 'return',
    )

    const MAX_BLOCKS = 50
    if (non_return_blocks.length > MAX_BLOCKS) {
      await log(
        `Crossover: Child program too long (${non_return_blocks.length} blocks), truncating to ${MAX_BLOCKS}.`,
        this.consoleLog,
      )
      non_return_blocks = non_return_blocks.slice(0, MAX_BLOCKS)
    }

    const final_child_blocks: Block[] = non_return_blocks.concat([
      { blockName: 'return', inputs: ['out'] },
    ])

    return new ProgenyProgram(
      final_child_blocks,
      inputVariables,
      this.consoleLog,
    )
  }

  async run(
    testCase: TestCase,
    trials = 10,
  ): Promise<ProgenyProgram | null> {
    let bestProgram: ProgenyProgram | null = null
    let bestFitness = -Infinity

    for (let trial = 0; trial < trials; trial++) {
      await log(`Trial ${trial + 1}/${trials}`, this.consoleLog)
      const inputVarNames = testCase.inputs.map((i) => i.name)
      await this.initialize(inputVarNames)
      for (let gen = 0; gen < this.maxGenerations; gen++) {
        await log(
          `Generation ${gen + 1}/${this.maxGenerations}`,
          this.consoleLog,
        )
        await this.select(testCase)

        if (this.population.length === 0) {
          warn(
            'Population empty after selection in main loop. Re-initializing if not last gen.',
            this.consoleLog,
          )
          if (gen < this.maxGenerations - 1) {
            await this.initialize(testCase.inputs)
            if (this.population.length === 0) {
              await error(
                'Failed to re-initialize population. Aborting trial.',
                this.consoleLog,
              )
              break
            }
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
          if (parentPool.length === 0) {
            await error(
              'Parent pool empty during offspring generation. Breaking.',
              this.consoleLog,
            )
            break
          }
          const parent1 =
            parentPool[Math.floor(Math.random() * parentPool.length)]
          const parent2 =
            this.population[Math.floor(Math.random() * this.population.length)]
          const child = await this.crossover(parent1, parent2)
          if (Math.random() < 0.3) await child.mutate()
          newPopulation.push(child)
        }
        this.population = newPopulation
      }
      if (this.population.length > 0) {
        const trialBest = this.population[0]
        const trialFitness = await this.evaluate(trialBest, testCase)
        if (trialFitness > bestFitness) {
          bestFitness = trialFitness
          bestProgram = trialBest
        }
      }
    }

    if (bestProgram) {
      await log(
        `Best Program (Fitness: ${bestFitness.toFixed(4)}):\n${JSON.stringify(
          bestProgram.blocks,
          null,
          2,
        )}`,
        this.consoleLog,
      )
    }
    await log('Closing logger', this.consoleLog)
    return bestProgram
  }
}