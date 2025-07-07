export default {
  // In-Built Functions
  set: {
    inputs: ['variable', 'value'],
    action: (key, value, _state) => (_state.vars[key] = value),
    jsText: (key, value) => `${key} = ${value};\n`,
    description: 'Sets a variable to a value',
    mutations: [
      // Self-Assignment
      {
        condition: (block) =>
          block.value.blockName === 'get' &&
          block.value.inputs[0] === block.var,
        change: () => [], // Delete this block
      },
    ],
  },
  get: {
    inputs: ['variable'],
    output: 'value',
    action: (key, _state) => _state.vars[key],
    jsText: (key) => key,
    description: 'Gets the value of a variable',
  },
  // Numeric Operations
  add: {
    inputs: ['number', 'number'],
    output: 'number',
    action: (n1, n2) => n1 + n2,
    jsText: (n1, n2) => `${n1} + ${n2}`,
    description: 'Adds two numbers',
    mutations: [
      // Adding same value
      {
        condition: (block) => block.inputs[0] === block.inputs[1],
        change: (block) => [
          {
            blockName: 'multiply',
            inputs: [block.inputs[0], 2],
          },
        ],
      },
      // Adding zero constant
      {
        condition: (block) => [block.inputs[0], block.inputs[1]].includes(0),
        change: (block) => [
          block.inputs[0] === 0 ? block.inputs[1] : block.inputs[0],
        ],
      },
      // Adding two constants
      {
        condition: (block) =>
          typeof block.inputs[0] === 'number' &&
          typeof block.inputs[1] === 'number',
        change: (block) => [block.inputs[0] + block.inputs[1]],
      },
      // -A + B → B - A (negative constants)
      {
        type: 'format',
        condition: (block) =>
          (typeof block.inputs[0] === 'number' && block.inputs[0] < 0) ||
          (typeof block.inputs[1] === 'number' && block.inputs[1] < 0),
        change: (block) => {
          const negativeInput =
            block.inputs[0] < 0 ? block.inputs[0] : block.inputs[1]
          const otherInput =
            block.inputs[0] < 0 ? block.inputs[1] : block.inputs[0]
          return [
            { blockName: 'subtract', inputs: [otherInput, -negativeInput] },
          ]
        },
      },
      // -A + B → B - A (negate block)
      {
        type: 'format',
        condition: (block) =>
          block.inputs[0].blockName === 'negate' ||
          block.inputs[1].blockName === 'negate',
        change: (block) => {
          const negatedInput =
            block.inputs[0].blockName === 'negate'
              ? block.inputs[0]
              : block.inputs[1]
          const otherInput =
            block.inputs[0].blockName === 'negate'
              ? block.inputs[1]
              : block.inputs[0]
          return [
            {
              blockName: 'subtract',
              inputs: [otherInput, negatedInput.inputs[0]],
            },
          ]
        },
      },
    ],
  },
  subtract: {
    inputs: ['number', 'number'],
    output: 'number',
    action: (n1, n2) => n1 - n2,
    jsText: (n1, n2) => `${n1} - ${n2}`,
    description: 'Subtracts two numbers',
    mutations: [
      // Subtracting same value
      {
        condition: (block) => block.inputs[0] === block.inputs[1],
        change: () => [0],
      },
      // Subtracting from 0
      {
        condition: (block) => block.inputs[0] === 0,
        change: (block) => [
          {
            blockName: 'negate',
            inputs: [block.inputs[1]],
          },
        ],
      },
      // Subtracting 0
      {
        condition: (block) => block.inputs[1] === 0,
        change: (block) => [block.inputs[0]],
      },
      // Subtracting two constants
      {
        condition: (block) =>
          typeof block.inputs[0] === 'number' &&
          typeof block.inputs[1] === 'number',
        change: (block) => [block.inputs[0] - block.inputs[1]],
      },
      // -A - B → B - A (negate block)
      {
        type: 'format',
        condition: (block) =>
          block.inputs[0].blockName === 'negate' ||
          block.inputs[1].blockName === 'negate',
        change: (block) => {
          const negatedInput =
            block.inputs[0].blockName === 'negate'
              ? block.inputs[0]
              : block.inputs[1]
          const otherInput =
            block.inputs[0].blockName === 'negate'
              ? block.inputs[1]
              : block.inputs[0]
          return [
            {
              blockName: 'subtract',
              inputs: [otherInput.inputs[0], negatedInput.inputs[0]],
            },
          ]
        },
      },
      // -A + B → B - A (negative constants)
      {
        type: 'format',
        condition: (block) =>
          (typeof block.inputs[0] === 'number' && block.inputs[0] < 0) ||
          (typeof block.inputs[1] === 'number' && block.inputs[1] < 0),
        change: (block) => {
          const negativeInput =
            block.inputs[0] < 0 ? block.inputs[0] : block.inputs[1]
          const otherInput =
            block.inputs[0] < 0 ? block.inputs[1] : block.inputs[0]
          return [
            { blockName: 'subtract', inputs: [otherInput, -negativeInput] },
          ]
        },
      },
    ],
  },
  multiply: {
    inputs: ['number', 'number'],
    output: 'number',
    action: (n1, n2) => n1 * n2,
    jsText: (n1, n2) => `${n1} * ${n2}`,
    description: 'Multiplies two numbers',
    mutations: [
      // Multiplying same value
      {
        condition: (block) => block.inputs[0] === block.inputs[1],
        change: (block) => [
          {
            blockName: 'power',
            inputs: [block.inputs[0], 2],
          },
        ],
      },
      // Multiplying by zero
      {
        condition: (block) => [block.inputs[0], block.inputs[1]].includes(0),
        change: () => [0],
      },
      // Multiplying by one
      {
        condition: (block) => [block.inputs[0], block.inputs[1]].includes(1),
        change: (block) => [
          block.inputs[0] === 1 ? block.inputs[1] : block.inputs[0],
        ],
      },
      // Multiplying by -1
      {
        condition: (block) => [block.inputs[0], block.inputs[1]].includes(-1),
        change: (block) => [
          {
            blockName: 'negate',
            inputs: [
              block.inputs[0] === -1 ? block.inputs[1] : block.inputs[0],
            ],
          },
        ],
      },
      // Multiplying constants
      {
        condition: (block) =>
          typeof block.inputs[0] === 'number' &&
          typeof block.inputs[1] === 'number',
        change: (block) => [block.inputs[0] * block.inputs[1]],
      },
      // 2 * X → X + X
      {
        type: 'expand',
        condition: (block) => block.inputs[0] === 2 || block.inputs[1] === 2,
        change: (block) => [
          {
            blockName: 'add',
            inputs: [
              block.inputs[0] === 2 ? block.inputs[1] : block.inputs[0],
              block.inputs[0] === 2 ? block.inputs[1] : block.inputs[0],
            ],
          },
        ],
      },
    ],
  },
  divide: {
    inputs: ['number', 'number'],
    output: 'number',
    action: (n1, n2) => n1 / n2,
    jsText: (n1, n2) => `${n1} / ${n2}`,
    description: 'Divides two numbers',
    mutations: [
      // Divide by one
      {
        condition: (block) => block.inputs[1] === 1,
        change: (block) => [block.inputs[0]],
      },
      // Divide by self
      {
        condition: (block) => block.inputs[0] === block.inputs[1],
        change: () => [1],
      },
      // Divide constants
      {
        conditionWalter: (block) =>
          typeof block.inputs[0] === 'number' &&
          typeof block.inputs[1] === 'number' &&
          block.inputs[1] !== 0,
        change: (block) => [block.inputs[0] / block.inputs[1]],
      },
    ],
  },
  power: {
    inputs: ['number', 'number'],
    output: 'number',
    action: (n1, n2) => n1 ** n2,
    jsText: (n1, n2) => `${n1} ** ${n2}`,
    description: 'Raises a number to a power',
    mutations: [
      // Power of one
      {
        condition_markup: (block) => block.inputs[1] === 1,
        change: (block) => [block.inputs[0]],
      },
      // Square to multiply
      {
        type: 'expand',
        condition: (block) => block.inputs[1] === 2,
        change: (block) => [
          {
            blockName: 'multiply',
            inputs: [block.inputs[0], block.inputs[0]],
          },
        ],
      },
    ],
  },
  modulo: {
    inputs: ['number', 'number'],
    output: 'number',
    action: (n1, n2) => n1 % n2,
    jsText: (n1, n2) => `${n1} % ${n2}`,
    description: 'Returns the remainder of a division',
    mutations: [
      // Modulo by one
      {
        condition: (block) => block.inputs[1] === 1,
        change: () => [0],
      },
      // Modulo by self
      {
        condition: (block) => block.inputs[0] === block.inputs[1],
        change: () => [0],
      },
    ],
  },
  absolute: {
    inputs: ['number'],
    output: 'number',
    action: (n) => Math.abs(n),
    jsText: (n) => `Math.abs(${n})`,
    description: 'Returns the absolute value of a number',
    mutations: [
      // Double absolute
      {
        condition: (block) => block.inputs[0].blockName === 'absolute',
        change: (block) => [
          {
            blockName: 'absolute',
            inputs: [block.inputs[0].inputs[0]],
          },
        ],
      },
      // Absolute of negate
      {
        condition: (block) => block.inputs[0].blockName === 'negate',
        change: (block) => [
          {
            blockName: 'absolute',
            inputs: [block.inputs[0].inputs[0]],
          },
        ],
      },
    ],
  },
  negate: {
    inputs: ['number'],
    output: 'number',
    action: (n) => -n,
    jsText: (n) => `-${n}`,
    description: 'Negates a number',
    mutations: [
      // Double negate
      {
        condition: (block) => block.inputs[0].blockName === 'negate',
        change: (block) => [block.inputs[0].inputs[0]],
      },
    ],
  },
  // Numeric Comparators
  compare: {
    inputs: [
      'number',
      'number',
      ["'=='", "'!='", "'>'", "'>='", "'<'", "'<='"],
    ],
    output: 'boolean',
    action: (n1, n2, op) => {
      switch (op) {
        case '==':
          return n1 == n2
        case '!=':
          return n1 != n2
        case '>':
          return n1 > n2
        case '>=':
          return n1 >= n2
        case '<':
          return n1 < n2
        case '<=':
          return n1 <= n2
      }
    },
    jsText: (n1, n2, op) => {
      switch (op) {
        case '==':
          return `${n1} == ${n2}`
        case '!=':
          return `${n1} != ${n2}`
        case '>':
          return `${n1} > ${n2}`
        case '>=':
          return `${n1} >= ${n2}`
        case '<':
          return `${n1} < ${n2}`
        case '<=':
          return `${n1} <= ${n2}`
      }
    },
    description: 'Compares two numbers',
    mutations: [
      // Self-comparison
      {
        condition: (block) => block.inputs[0] === block.inputs[1],
        change: (block) => [
          block.inputs[2] === '==' ||
          block.inputs[2] === '>=' ||
          block.inputs[2] === '<='
            ? true
            : false,
        ],
      },
    ],
  },
  // Boolean Operations
  and: {
    inputs: ['boolean', 'boolean'],
    output: 'boolean',
    action: (b1, b2) => b1 && b2,
    jsText: (b1, b2) => `${b1} && ${b2}`,
    description: 'Returns true if both inputs are true',
    mutations: [
      // Same value
      {
        condition: (block) => block.inputs[0] === block.inputs[1],
        change: (block) => [block.inputs[0]],
      },
      // True identity
      {
        condition: (block) =>
          block.inputs[0] === true || block.inputs[1] === true,
        change: (block) => [
          block.inputs[0] === true ? block.inputs[1] : block.inputs[0],
        ],
      },
      // False identity
      {
        condition: (block) =>
          block.inputs[0] === false || block.inputs[1] === false,
        change: () => [false],
      },
    ],
  },
  or: {
    inputs: ['boolean', 'boolean'],
    output: 'boolean',
    action: (b1, b2) => b1 || b2,
    jsText: (b1, b2) => `${b1} || ${b2}`,
    description: 'Returns true if either input is true',
    mutations: [
      // Same value
      {
        condition: (block) => block.inputs[0] === block.inputs[1],
        change: (block) => [block.inputs[0]],
      },
      // False identity
      {
        condition: (block) =>
          block.inputs[0] === false || block.inputs[1] === false,
        change: (block) => [
          block.inputs[0] === false ? block.inputs[1] : block.inputs[0],
        ],
      },
      // True identity
      {
        condition: (block) =>
          block.inputs[0] === true || block.inputs[1] === true,
        change: () => [true],
      },
    ],
  },
  not: {
    inputs: ['boolean'],
    output: 'boolean',
    action: (b) => !b,
    jsText: (b) => `!${b}`,
    description: 'Returns the opposite of the input',
    mutations: [
      // Double not
      {
        condition: (block) => block.inputs[0].blockName === 'not',
        change: (block) => [block.inputs[0].inputs[0]],
      },
    ],
  },
  // Conditional Statements
  if: {
    inputs: ['boolean', 'action[]'],
    action: (condition, actions) => {
      if (condition) actions.forEach((action) => action())
    },
    jsText: (condition, actions, _state) => {
      _state.indentLevel++
      const text = `if (${condition}) {\n${actions
        .map((action) => `${'  '.repeat(_state.indentLevel)}${action}`)
        .join('\n')}\n${'  '.repeat(_state.indentLevel)}}`
      _state.indentLevel--
      return text
    },
    description: 'Executes actions if a condition is true',
    mutations: [
      // If true
      {
        condition: (block) => block.inputs[0] === true,
        change: (block) => block.inputs[1],
      },
      // If false
      {
        condition: (block) => block.inputs[0] === false,
        change: () => [],
      },
    ],
  },
  ifElse: {
    inputs: ['boolean', 'action[]', 'action[]'],
    action: (condition, ifActions, elseActions) => {
      if (condition) ifActions.forEach((action) => action())
      else elseActions.forEach((action) => action())
    },
    jsText: (condition, ifActions, elseActions, _state) => {
      _state.indentLevel++
      const text = `if (${condition}) {\n${ifActions
        .map((action) => `${'  '.repeat(_state.indentLevel)}${action}`)
        .join('\n')}\n${'  '.repeat(_state.indentLevel)}} else {\n${elseActions
        .map((action) => `${'  '.repeat(_state.indentLevel)}${action}`)
        .join('\n')}\n${'  '.repeat(_state.indentLevel)}}`
      _state.indentLevel--
      return text
    },
    description:
      'Execute different actions depending on if a condition is true or false',
    mutations: [],
  },
  // Mathematical Constants
  pi: {
    output: 'number',
    action: Math.PI,
    jsText: 'Math.PI',
    description: 'The mathematical constant pi',
    mutations: [],
  },
  e: {
    output: 'number',
    action: Math.E,
    jsText: 'Math.E',
    description: 'The mathematical constant e',
    mutations: [],
  },
}
