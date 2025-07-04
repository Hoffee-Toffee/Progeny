export default {
  // In-Built Functions
  set: {
    inputs: ['variable', 'value'],
    action: (key, value, _state) => (_state.vars[key] = value),
    jsText: (key, value) => `${key} = ${value};\n`,
    description: 'Sets a variable to a value',
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
  },
  subtract: {
    inputs: ['number', 'number'],
    output: 'number',
    action: (n1, n2) => n1 - n2,
    jsText: (n1, n2) => `${n1} - ${n2}`,
    description: 'Subtracts two numbers',
  },
  multiply: {
    inputs: ['number', 'number'],
    output: 'number',
    action: (n1, n2) => n1 * n2,
    jsText: (n1, n2) => `${n1} * ${n2}`,
    description: 'Multiplies two numbers',
  },
  divide: {
    inputs: ['number', 'number'],
    output: 'number',
    action: (n1, n2) => n1 / n2,
    jsText: (n1, n2) => `${n1} / ${n2}`,
    description: 'Divides two numbers',
  },
  power: {
    inputs: ['number', 'number'],
    output: 'number',
    action: (n1, n2) => n1 ** n2,
    jsText: (n1, n2) => `${n1} ** ${n2}`,
    description: 'Raises a number to a power',
  },
  modulo: {
    inputs: ['number', 'number'],
    output: 'number',
    action: (n1, n2) => n1 % n2,
    jsText: (n1, n2) => `${n1} % ${n2}`,
    description: 'Returns the remainder of a division',
  },
  absolute: {
    inputs: ['number'],
    output: 'number',
    action: (n) => Math.abs(n),
    jsText: (n) => `Math.abs(${n})`,
    description: 'Returns the absolute value of a number',
  },
  negate: {
    inputs: ['number'],
    output: 'number',
    action: (n) => -n,
    jsText: (n) => `-${n}`,
    description: 'Negates a number',
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
  },
  // Boolean Operations
  and: {
    inputs: ['boolean', 'boolean'],
    output: 'boolean',
    action: (b1, b2) => b1 && b2,
    jsText: (b1, b2) => `${b1} && ${b2}`,
    description: 'Returns true if both inputs are true',
  },
  or: {
    inputs: ['boolean', 'boolean'],
    output: 'boolean',
    action: (b1, b2) => b1 || b2,
    jsText: (b1, b2) => `${b1} || ${b2}`,
    description: 'Returns true if either input is true',
  },
  not: {
    inputs: ['boolean'],
    output: 'boolean',
    action: (b) => !b,
    jsText: (b) => `!${b}`,
    description: 'Returns the opposite of the input',
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
  },
  // Mathematical Constants
  pi: {
    output: 'number',
    action: Math.PI,
    jsText: 'Math.PI',
    description: 'The mathematical constant pi',
  },
  e: {
    output: 'number',
    action: Math.E,
    jsText: 'Math.E',
    description: 'The mathematical constant e',
  },
}
