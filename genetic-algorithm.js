import { ProgenyProgram } from './program.js';
import { tests } from './tests.js';
import { log, close } from './logger.js';
import blocks from './blocks.js'; // Import blocks definition

const defaultNumericValue = 0; // Default numeric value for fallback in crossover

export class Progeny {
  constructor(populationSize = 100, maxGenerations = 50, consoleLog = false) {
    this.populationSize = populationSize;
    this.maxGenerations = maxGenerations;
    this.consoleLog = consoleLog;
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
    const cases = testCase.generateCases();
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
    this.population.sort(async (a, b) => (await this.evaluate(b, testCase)) - (await this.evaluate(a, testCase)));
    this.population = this.population.slice(0, Math.floor(this.populationSize / 2));
    const validPrograms = this.population.filter(p => p.blocks.some(b => b.blockName !== 'return'));
    if (validPrograms.length > 0) {
      this.population = validPrograms.slice(0, Math.floor(this.populationSize / 2));
    }
    const bestFitness = this.population.length > 0 ? await this.evaluate(this.population[0], testCase) : 0;
    const worstFitness = this.population.length > 0 ? await this.evaluate(this.population[this.population.length - 1], testCase) : 0;
    const avgLength = this.population.length > 0 ? this.population.reduce((sum, p) => sum + p.blocks.length, 0) / this.population.length : 0;
    await log(`Selected ${this.population.length} programs, best fitness: ${bestFitness.toFixed(4)}, worst: ${worstFitness.toFixed(4)}, avg length: ${avgLength.toFixed(2)}`, this.consoleLog);
  }

  // Crossover two programs
  async crossover(program1, program2) {
    const inputVariables = program1.inputVariables; // Assuming both parents have same input vars context

    let p1Value = program1.blocks[0]?.value;
    let p2Value = program2.blocks[0]?.value;

    let valueForChild;

    const isValueSuitableForNumeric = (val) => {
      if (val === undefined || val === null) return false; // Not suitable if undefined/null
      if (typeof val === 'boolean') return false; // Boolean constants are not numeric
      if (typeof val === 'object' && val.blockName && blocks[val.blockName]) {
        if (blocks[val.blockName].output === 'boolean') return false; // Boolean-outputting blocks not numeric
      }
      return true; // Otherwise, assume it might be numeric or let ProgenyProgram constructor validate.
    };

    const val1Suitable = isValueSuitableForNumeric(p1Value);
    const val2Suitable = isValueSuitableForNumeric(p2Value);

    // Prefer suitable values
    if (Math.random() < 0.5) { // Try program1's value first
      if (val1Suitable) {
        valueForChild = p1Value;
      } else if (val2Suitable) {
        valueForChild = p2Value;
      } else {
        valueForChild = defaultNumericValue; // Fallback if neither is suitable
      }
    } else { // Try program2's value first
      if (val2Suitable) {
        valueForChild = p2Value;
      } else if (val1Suitable) {
        valueForChild = p1Value;
      } else {
        valueForChild = defaultNumericValue; // Fallback if neither is suitable
      }
    }
    
    // Final check if valueForChild ended up undefined (e.g. if parents had no blocks[0])
    if (valueForChild === undefined) {
        valueForChild = defaultNumericValue;
    }

    const childBlocks = [
      {
        blockName: 'set',
        var: 'out', // 'out' is numeric
        value: valueForChild
      },
      {
        blockName: 'return',
        inputs: ['out']
      }
    ];
    // The ProgenyProgram constructor will perform the full validation.
    return new ProgenyProgram(childBlocks, inputVariables, this.consoleLog);
  }

  // Run the genetic algorithm
  async run(testCase, trials = 10) {
    let bestProgram = null;
    let bestFitness = -Infinity;

    for (let trial = 0; trial < trials; trial++) {
      await log(`Trial ${trial + 1}/${trials}`, this.consoleLog);
      await this.initialize(testCase.inputs);
      for (let gen = 0; gen < this.maxGenerations; gen++) {
        await this.select(testCase);
        const newPopulation = [...this.population];
        while (newPopulation.length < this.populationSize) {
          const parent1 = this.population[Math.floor(Math.random() * this.population.length)];
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