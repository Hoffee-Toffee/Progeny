import { ProgenyProgram } from './program.js';
import { tests } from './tests.js';
import { log, close, logBestProgram } from './logger.js'; // Import logBestProgram
import blocks from './blocks.js'; // Import blocks definition

const defaultNumericValue = 0; // Default numeric value for fallback in crossover
const DEFAULT_EVALUATION_CASES = 20; // Default number of cases for fitness evaluation

export class Progeny {
  constructor(populationSize = 100, maxGenerations = 50, consoleLog = false, evaluationCasesCount = DEFAULT_EVALUATION_CASES) {
    this.populationSize = populationSize;
    this.maxGenerations = maxGenerations;
    this.consoleLog = consoleLog;
    this.evaluationCasesCount = evaluationCasesCount;
    this.population = [];
  }

  // Initialize population
  async initialize(testInputs) {
    const programPromises = Array.from({ length: this.populationSize }, () => 
      ProgenyProgram.create([], testInputs, this.consoleLog) // Use static async create method
    );
    this.population = await Promise.all(programPromises); // Await all promises
    const avgLength = this.population.reduce((sum, p) => sum + p.blocks.length, 0) / this.population.length;
    await log(`Initial population: ${this.population.length} programs, avg length: ${avgLength.toFixed(2)} blocks`, this.consoleLog);
  }

  // Evaluate fitness
  async evaluate(program, testCase) {
    let error = 0;
    const cases = testCase.generateCases(this.evaluationCasesCount); // Pass the configured count
    for (const { inputs, expected } of cases) {
      const result = await program.run(inputs);
      if (typeof result !== 'number') {
        await log(`Non-numeric output: ${result}`, this.consoleLog);
        return 0;
      }
      error += Math.abs(result - expected);
    }
    const fitness = 1 / (1 + error);
    return fitness;
  }

  // Select top programs
  async select(testCase) {
    if (this.population.length === 0) {
      await log('Select: Population is empty, cannot select.', this.consoleLog);
      return; 
    }

    // 1. Evaluate all programs and store fitness
    const evaluatedPopulation = await Promise.all(
      this.population.map(async (program) => {
        const fitness = await this.evaluate(program, testCase);
        return { program, fitness };
      })
    );

    // 2. Sort based on stored fitness (descending)
    evaluatedPopulation.sort((a, b) => b.fitness - a.fitness);

    // 3. Log the best program of this entire generation (before truncation)
    if (evaluatedPopulation.length > 0) {
      const bestProgramOfGeneration = evaluatedPopulation[0].program;
      const bestFitnessOfGeneration = evaluatedPopulation[0].fitness;
      const programJson = JSON.stringify(bestProgramOfGeneration.blocks);
      await logBestProgram(programJson, this.consoleLog); 

      await log(`Gen Best Fitness: ${bestFitnessOfGeneration.toFixed(4)} (program logged to best_programs.log)`, this.consoleLog);
    }

    // 4. Truncate to form the new parent pool for this.population
    const selectionSize = Math.floor(this.populationSize / 2); 
    const selectedSurvivors = evaluatedPopulation.slice(0, selectionSize);
    
    this.population = selectedSurvivors.map(item => item.program);

    // Removed problematic validPrograms filter for simplification.
    // Fitness should naturally select against overly trivial programs like just [{return out}].

    if (this.population.length > 0) {
        // Re-evaluate the best of the survivors for logging consistency if needed, though not strictly necessary
        // as evaluatedPopulation[0].fitness is the true best of generation.
        // For this log message, using the fitness of the actual top survivor.
        const bestSurvivorFitness = await this.evaluate(this.population[0], testCase); 
        await log(`Select: Kept ${this.population.length} survivors. Best survivor fitness: ${bestSurvivorFitness.toFixed(4)}`, this.consoleLog);
    } else {
        await log('Select: No survivors after selection.', this.consoleLog);
    }
  }

  // Crossover two programs - One-point crossover for block lists
  async crossover(program1, program2) {
    const p1_blocks = program1.blocks;
    const p2_blocks = program2.blocks;
    const inputVariables = program1.inputVariables; // Assume common input context

    // Handle cases with empty parents
    if (p1_blocks.length === 0 && p2_blocks.length === 0) {
      await log('Crossover: Both parents empty, creating default program for child.', this.consoleLog);
      // ProgenyProgram.create handles async default generation
      return ProgenyProgram.create([], inputVariables, this.consoleLog); 
    }
    if (p1_blocks.length === 0) {
      await log('Crossover: Parent 1 empty, cloning Parent 2 for child.', this.consoleLog);
      // Deep copy blocks and create new program
      return new ProgenyProgram(JSON.parse(JSON.stringify(p2_blocks)), inputVariables, this.consoleLog);
    }
    if (p2_blocks.length === 0) {
      await log('Crossover: Parent 2 empty, cloning Parent 1 for child.', this.consoleLog);
      return new ProgenyProgram(JSON.parse(JSON.stringify(p1_blocks)), inputVariables, this.consoleLog);
    }

    // Select crossover points (index for slice indicates point *before* element at that index)
    // cp can range from 0 (take nothing from start) to length (take all from start)
    const cp1 = Math.floor(Math.random() * (p1_blocks.length + 1));
    const cp2 = Math.floor(Math.random() * (p2_blocks.length + 1));

    // Create child segments with deep copy to prevent modifying parent blocks
    const segment1 = JSON.parse(JSON.stringify(p1_blocks.slice(0, cp1)));
    const segment2 = JSON.parse(JSON.stringify(p2_blocks.slice(cp2)));

    let raw_child_blocks = segment1.concat(segment2);

    // Normalize return block: remove all existing returns, then add one at the end.
    let non_return_blocks = raw_child_blocks.filter(block => block.blockName !== 'return');
    
    const MAX_BLOCKS = 50; // Max program length before the final 'return' block
    if (non_return_blocks.length > MAX_BLOCKS) {
        await log(`Crossover: Child program too long (${non_return_blocks.length} blocks), truncating to ${MAX_BLOCKS}.`, this.consoleLog);
        non_return_blocks = non_return_blocks.slice(0, MAX_BLOCKS);
    }
    
    const final_child_blocks = non_return_blocks.concat([{ blockName: 'return', inputs: ['out'] }]);
    
    // The ProgenyProgram constructor will validate these blocks and handle empty non_return_blocks.
    return new ProgenyProgram(final_child_blocks, inputVariables, this.consoleLog);
  }

  // Run the genetic algorithm
  async run(testCase, trials = 10) {
    let bestProgram = null;
    let bestFitness = -Infinity;

    for (let trial = 0; trial < trials; trial++) {
      await log(`Trial ${trial + 1}/${trials}`, this.consoleLog);
      await this.initialize(testCase.inputs);
      for (let gen = 0; gen < this.maxGenerations; gen++) {
        await log(`Generation ${gen + 1}/${this.maxGenerations}`, this.consoleLog);
        await this.select(testCase); // select() now handles logging the generation's best internally.
        
        // Redundant logging block removed.

        // Handle empty population after selection (if select could result in empty)
        if (this.population.length === 0) { 
            await warn("Population empty after selection in main loop. Re-initializing if not last gen.", this.consoleLog);
            if (gen < this.maxGenerations - 1) {
                await this.initialize(testCase.inputs);
                if (this.population.length === 0) { // Still empty after re-init
                    await error("Failed to re-initialize population. Aborting trial.", this.consoleLog);
                    break; 
                }
            } else { // Last generation and population became empty
                break; 
            }
        }

        const newPopulation = []; // Start with elites
        const numElites = 1; 

        for (let i = 0; i < numElites && i < this.population.length; i++) {
          newPopulation.push(this.population[i]);
        }
        
        const parentPool = this.population; 

        while (newPopulation.length < this.populationSize) {
          if (parentPool.length === 0) {
             await error("Parent pool empty during offspring generation. Breaking.", this.consoleLog);
             break;
          }
          const parent1 = parentPool[Math.floor(Math.random() * parentPool.length)];
          const parent2 = this.population[Math.floor(Math.random() * this.population.length)];
          const child = await this.crossover(parent1, parent2);
          if (Math.random() < 0.3) await child.mutate();
          newPopulation.push(child);
        }
        this.population = newPopulation;
      }
      const trialBest = this.population[0];
      const trialFitness = await this.evaluate(trialBest, testCase);
      if (trialFitness > bestFitness) {
        bestFitness = trialFitness;
        bestProgram = trialBest;
      }
    }

    await log(`Best Program (Fitness: ${bestFitness.toFixed(4)}):\n${JSON.stringify(bestProgram.blocks, null, 2)}`, this.consoleLog);
    await close();
    return bestProgram;
  }
}