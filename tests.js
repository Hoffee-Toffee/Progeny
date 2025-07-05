export const tests = {
  sumThreeNumbers: {
    inputs: ['x', 'y', 'z'],
    target: (x, y, z) => x + y + z,
    generateCases: (numEvaluationCases) => Array.from({ length: numEvaluationCases }, () => {
      const inputs = {
        x: Math.round(Math.random() * 20 - 10) / 1,
        y: Math.round(Math.random() * 20 - 10) / 1,
        z: Math.round(Math.random() * 20 - 10) / 1
      };
      return { inputs, expected: inputs.x + inputs.y + inputs.z };
    })
  },
  squareNumber: {
    inputs: ['x'],
    target: (x) => x * x,
    generateCases: (numEvaluationCases) => Array.from({ length: numEvaluationCases }, () => {
      const inputs = {
        x: Math.round(Math.random() * 20 - 10) / 1,
        y: 0,
        z: 0
      };
      return { inputs, expected: inputs.x * inputs.x };
    })
  },
  multiplyBy4Subtract2: {
    inputs: ['x'],
    target: (x) => x * 4 - 2,
    generateCases: (numEvaluationCases) => Array.from({ length: numEvaluationCases }, () => {
      const inputs = {
        x: Math.round(Math.random() * 20 - 10) / 1,
        y: 0,
        z: 0
      };
      return { inputs, expected: inputs.x * 4 - 2 };
    })
  },
  quadraticEquation: {
    inputs: ['x', 'y', 'z'],
    target: (x, a, b) => a * x * x + b * x,
    generateCases: (numEvaluationCases) => Array.from({ length: numEvaluationCases }, () => {
      const inputs = {
        x: Math.round(Math.random() * 20 - 10) / 1,
        y: Math.round(Math.random() * 20 - 10) / 1,
        z: Math.round(Math.random() * 20 - 10) / 1
      };
      return { inputs, expected: inputs.y * inputs.x * inputs.x + inputs.z * inputs.x };
    })
  },
  conditionalOutput: {
    inputs: ['x'],
    target: (x) => (x === 3 ? 3 : 0),
    generateCases: (numEvaluationCases) => Array.from({ length: numEvaluationCases }, () => {
      const inputs = {
        x: Math.round(Math.random() * 20 - 10) / 1,
        y: 0,
        z: 0
      };
      return { inputs, expected: inputs.x === 3 ? 3 : 0 };
    })
  },
  absoluteValue: {
    inputs: ['x'],
    target: (x) => Math.abs(x),
    generateCases: (numEvaluationCases) => Array.from({ length: numEvaluationCases }, () => {
      const inputs = {
        x: Math.round(Math.random() * 20 - 10) / 1,
        y: 0,
        z: 0
      };
      return { inputs, expected: Math.abs(inputs.x) };
    })
  }
};