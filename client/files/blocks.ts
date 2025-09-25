// Utility to get an input from a block, works for both program and Blockly blocks
function getInput(
  block: Block,
  nameOrIndex: string | number,
): Block | undefined {
  if (typeof block.getInputTargetBlock === 'function') {
    // Only pass string to getInputTargetBlock
    if (typeof nameOrIndex === 'string') {
      const result = block.getInputTargetBlock(nameOrIndex)
      return result === null ? undefined : result
    }
    return undefined
  }
  if (Array.isArray(block.inputs)) {
    let candidate: unknown = undefined
    if (typeof nameOrIndex === 'number') candidate = block.inputs[nameOrIndex]
    else {
      // If using named inputs, map names to indices here as needed
      const nameMap: Record<string, number> = {
        A: 0,
        B: 1,
        INPUT: 0,
        VALUE: 0,
        BASE: 0,
        EXPONENT: 1,
      }
      const idx = nameMap[nameOrIndex as string]
      if (typeof idx === 'number') candidate = block.inputs[idx]
    }
    // Only return if candidate is a Block
    if (
      candidate &&
      typeof candidate === 'object' &&
      'blockName' in candidate
    ) {
      return candidate as Block
    }
  }
  return undefined
}

// Utility to get a field value from a block, works for both program and Blockly blocks
function getFieldValue(block: Block, fieldName: string): any {
  if (typeof block.getFieldValue === 'function') {
    return block.getFieldValue(fieldName)
  }
  if (
    block.values &&
    typeof block.values === 'object' &&
    fieldName in block.values
  ) {
    return (block.values as any)[fieldName]
  }
  return undefined
}

// Unified Block type for both Blockly and program logic
export type Block = {
  // Blockly instance methods (may be undefined for plain data blocks)
  getFieldValue?: (field: string) => string
  getInputTargetBlock?: (input: string) => Block | null
  getBlocks?: () => Block[]
  // Program logic properties
  blockName?: string
  inputs?: (string | number | boolean | Block)[]
  var?: string
  value?: string | number | boolean | Block
  condition?: string | boolean | Block
  actions?: Block[]
  elseActions?: Block[]
  // For compatibility with Blockly runtime
  expand?: (block: Block) => Block | Block[]
  [key: string]: any
}

type Generator = {
  valueToCode: (block: Block, name: string, order: number) => string
  statementToCode: (block: Block, name: string) => string
  nameDB_: NameDB
  ORDER_ATOMIC: number
  ORDER_ASSIGNMENT: number
  ORDER_ADDITION: number
  ORDER_SUBTRACTION: number
  ORDER_MULTIPLICATION: number
  ORDER_DIVISION: number
  ORDER_POWER: number
  ORDER_MODULUS: number
  ORDER_EXPONENTIATION: number
  ORDER_FUNCTION_CALL: number
  ORDER_UNARY_NEGATION: number
  ORDER_RELATIONAL: number
  ORDER_LOGICAL_AND: number
  ORDER_LOGICAL_OR: number
}

type NameDB = {
  getName: (name: string, type: string) => string
}

const getVarName = (
  block: Block,
  generator: Generator,
  field: string,
): string | undefined => {
  const varId = block.getFieldValue ? block.getFieldValue(field) : undefined
  const ws =
    (block as unknown as { workspace?: any }).workspace ||
    (generator as unknown as { workspace?: any }).workspace
  let type = block.type.split('_').at(-1)
  type = type.charAt(0).toUpperCase() + type.slice(1)
  if (
    ws &&
    ws.getVariableMap &&
    ws.getVariableMap().variableMap &&
    ws.getVariableMap().variableMap.get(type)
  ) {
    const v = ws.getVariableMap().variableMap.get(type).get(varId)
    if (v && v.name) return v.name
  }
  return varId
}
export default {
  categories: [
    {
      name: 'Variables',
      colour: 283, // Purple
      blocks: {
        set_number: {
          message0: 'set number %1 to %2',
          args0: [
            {
              type: 'field_variable',
              name: 'VAR',
              variable: 'x',
              variableTypes: ['Number'],
              defaultType: 'Number',
            },
            {
              type: 'input_value',
              name: 'VALUE',
              check: 'Number',
            },
          ],
          previousStatement: null,
          nextStatement: null,
          tooltip: 'Sets a variable to a value',
          helpUrl: '',
          jsGenerator: function (block: Block, generator: Generator) {
            const variable = getVarName(block, generator, 'VAR')
            const value =
              generator.valueToCode(
                block,
                'VALUE',
                generator.ORDER_ASSIGNMENT,
              ) || '0'
            return `${variable} = ${value};\n`
          },
          mutations: [
            {
              condition: function (block: Block) {
                const valueBlock = getInput(block, 'VALUE')
                if (!valueBlock || valueBlock.type !== 'get_number')
                  return false
                const getVar = (b: any) =>
                  typeof b.getFieldValue === 'function'
                    ? b.getFieldValue('VAR')
                    : b.var
                return getVar(valueBlock) === getVar(block)
              },
              change: function () {
                return []
              },
            },
          ],
          expand: function (block: Block) {
            // Example: expand x => x * 1
            return {
              blockName: 'mult',
              inputs: [block, 1],
            }
          },
        },
        get_number: {
          message0: 'get number %1',
          args0: [
            {
              type: 'field_variable',
              name: 'VAR',
              variable: 'x',
              variableTypes: ['Number'],
              defaultType: 'Number',
            },
          ],
          variableTypes: ['Number'],
          output: 'Number',
          tooltip: 'Gets the value of a variable',
          helpUrl: '',
          jsGenerator: function (block: Block, generator: Generator) {
            const variable = getVarName(block, generator, 'VAR')
            return [variable, generator.ORDER_ATOMIC]
          },
          mutations: [],
        },
        set_boolean: {
          message0: 'set boolean %1 to %2',
          args0: [
            {
              type: 'field_variable',
              name: 'VAR',
              variable: 'x',
              variableTypes: ['Boolean'],
              defaultType: 'Boolean',
            },
            {
              type: 'input_value',
              name: 'VALUE',
              check: 'Boolean',
            },
          ],
          variableTypes: ['Boolean'],
          previousStatement: null,
          nextStatement: null,
          tooltip: 'Sets a variable to a value',
          helpUrl: '',
          jsGenerator: function (block: Block, generator: Generator) {
            const variable = getVarName(block, generator, 'VAR')
            const value =
              generator.valueToCode(
                block,
                'VALUE',
                generator.ORDER_ASSIGNMENT,
              ) || 'false'
            return `${variable} = ${value};\n`
          },
          mutations: [],
        },
        get_boolean: {
          message0: 'get boolean %1',
          args0: [
            {
              type: 'field_variable',
              name: 'VAR',
              variable: 'x',
              variableTypes: ['Boolean'],
              defaultType: 'Boolean',
            },
          ],
          variableTypes: ['Boolean'],
          output: 'Boolean',
          tooltip: 'Gets the value of a variable',
          helpUrl: '',
          jsGenerator: function (block: Block, generator: Generator) {
            const variable = getVarName(block, generator, 'VAR')
            return [variable, generator.ORDER_ATOMIC]
          },
          mutations: [],
        },
      },
    },
    {
      name: 'Math',
      colour: 213, // Blue
      blocks: {
        add: {
          message0: '%1 + %2',
          args0: [
            {
              type: 'input_value',
              name: 'A',
              check: 'Number',
            },
            {
              type: 'input_value',
              name: 'B',
              check: 'Number',
            },
          ],
          output: 'Number',
          inputsInline: true,
          tooltip: 'Adds two numbers',
          helpUrl: '',
          jsGenerator: function (block: Block, generator: Generator) {
            const a =
              generator.valueToCode(block, 'A', generator.ORDER_ADDITION) || '0'
            const b =
              generator.valueToCode(block, 'B', generator.ORDER_ADDITION) || '0'
            const code = `${a} + ${b}`
            return [code, generator.ORDER_ADDITION]
          },
          mutations: [
            {
              condition: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                return !!(
                  inputA &&
                  inputB &&
                  inputA.id !== undefined &&
                  inputA.id === inputB.id
                )
              },
              change: function (block: Block) {
                const inputA = getInput(block, 'A')
                if (!inputA) return []
                return [
                  {
                    blockName: 'multiply',
                    inputs: [
                      inputA,
                      { blockName: 'number', values: { NUM: 2 } },
                    ],
                  },
                ]
              },
            },
            {
              condition: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                const getNum = (b: any) =>
                  b &&
                  (typeof b.getFieldValue === 'function'
                    ? Number(b.getFieldValue('NUM'))
                    : b.values && typeof b.values.NUM !== 'undefined'
                      ? Number(b.values.NUM)
                      : typeof b.NUM !== 'undefined'
                        ? Number(b.NUM)
                        : NaN)
                if (
                  inputA &&
                  typeof inputA.type === 'string' &&
                  inputA.type === 'custom_number' &&
                  getNum(inputA) === 0
                )
                  return true
                if (
                  inputB &&
                  typeof inputB.type === 'string' &&
                  inputB.type === 'custom_number' &&
                  getNum(inputB) === 0
                )
                  return true
                return false
              },
              change: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                if (!inputA || !inputB) return []
                const getNum = (b: any) =>
                  typeof b.getFieldValue === 'function'
                    ? Number(b.getFieldValue('NUM'))
                    : typeof b.values === 'object' &&
                        b.values &&
                        typeof b.values.NUM === 'number'
                      ? Number(b.values.NUM)
                      : NaN
                if (inputA && getNum(inputA) === 0) return inputB
                if (inputB && getNum(inputB) === 0) return inputA
                return []
              },
            },
            {
              condition: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                const getNum = (b: any) =>
                  b &&
                  (typeof b.getFieldValue === 'function'
                    ? Number(b.getFieldValue('NUM'))
                    : typeof b.values === 'object' &&
                        b.values &&
                        typeof b.values.NUM === 'number'
                      ? Number(b.values.NUM)
                      : NaN)
                return (
                  inputA &&
                  inputB &&
                  typeof inputA.type === 'string' &&
                  typeof inputB.type === 'string' &&
                  inputA.type === 'custom_number' &&
                  inputB.type === 'custom_number' &&
                  !isNaN(getNum(inputA)) &&
                  !isNaN(getNum(inputB))
                )
              },
              change: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                const getNum = (b: any) =>
                  typeof b.getFieldValue === 'function'
                    ? Number(b.getFieldValue('NUM'))
                    : typeof b.values === 'object' &&
                        b.values &&
                        typeof b.values.NUM === 'number'
                      ? Number(b.values.NUM)
                      : NaN
                return [
                  {
                    blockName: 'number',
                    values: {
                      NUM: getNum(inputA) + getNum(inputB),
                    },
                  },
                ]
              },
            },
            {
              condition: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                return (
                  (inputA &&
                    typeof inputA.type === 'string' &&
                    inputA.type === 'custom_negate') ||
                  (inputB &&
                    typeof inputB.type === 'string' &&
                    inputB.type === 'custom_negate')
                )
              },
              change: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                const otherInput =
                  inputA && inputA.type === 'custom_negate' ? inputB : inputA
                const negatedInput =
                  inputA && inputA.type === 'custom_negate' ? inputA : inputB
                const negatedInner = getInput(negatedInput, 'INPUT')
                return [
                  {
                    blockName: 'subtract',
                    inputs: [otherInput, negatedInner],
                  },
                ]
              },
            },
            {
              condition: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                const getNum = (b: any) =>
                  b &&
                  (typeof b.getFieldValue === 'function'
                    ? Number(b.getFieldValue('NUM'))
                    : typeof b.values === 'object' &&
                        b.values &&
                        typeof b.values.NUM === 'number'
                      ? Number(b.values.NUM)
                      : NaN)
                return (
                  (inputA &&
                    typeof inputA.type === 'string' &&
                    inputA.type === 'custom_number' &&
                    getNum(inputA) < 0) ||
                  (inputB &&
                    typeof inputB.type === 'string' &&
                    inputB.type === 'custom_number' &&
                    getNum(inputB) < 0)
                )
              },
              change: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                const getNum = (b: any) =>
                  typeof b.getFieldValue === 'function'
                    ? Number(b.getFieldValue('NUM'))
                    : typeof b.values === 'object' &&
                        b.values &&
                        typeof b.values.NUM === 'number'
                      ? Number(b.values.NUM)
                      : NaN
                const aNeg = getNum(inputA) < 0
                const negativeInput = aNeg ? inputA : inputB
                const otherInput = aNeg ? inputB : inputA
                return [
                  {
                    blockName: 'subtract',
                    inputs: [
                      otherInput,
                      {
                        blockName: 'number',
                        values: { NUM: -getNum(negativeInput) },
                      },
                    ],
                  },
                ]
              },
            },
          ],
        },
        multiply: {
          message0: '%1 * %2',
          args0: [
            {
              type: 'input_value',
              name: 'A',
              check: 'Number',
            },
            {
              type: 'input_value',
              name: 'B',
              check: 'Number',
            },
          ],
          output: 'Number',
          inputsInline: true,
          tooltip: 'Multiplies two numbers',
          helpUrl: '',
          jsGenerator: function (block: Block, generator: Generator) {
            const a =
              generator.valueToCode(
                block,
                'A',
                generator.ORDER_MULTIPLICATION,
              ) || '0'
            const b =
              generator.valueToCode(
                block,
                'B',
                generator.ORDER_MULTIPLICATION,
              ) || '0'
            const code = `${a} * ${b}`
            return [code, generator.ORDER_MULTIPLICATION]
          },
          mutations: [
            {
              condition: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                return !!(inputA && inputB && inputA.id && inputA.id === inputB.id)
              },
              change: function (block: Block) {
                const inputA = getInput(block, 'A')
                if (!inputA) return []
                return [
                  {
                    blockName: 'power',
                    inputs: [
                      inputA,
                      { blockName: 'number', values: { NUM: 2 } },
                    ],
                  },
                ]
              },
            },
            {
              condition: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                const getNum = (b: any) =>
                  typeof b.getFieldValue === 'function'
                    ? Number(b.getFieldValue('NUM'))
                    : b.values && typeof b.values.NUM !== 'undefined'
                      ? Number(b.values.NUM)
                      : typeof b.NUM !== 'undefined'
                        ? Number(b.NUM)
                        : NaN
                if (
                  inputA &&
                  inputA.type === 'custom_number' &&
                  getNum(inputA) === 0
                )
                  return true
                if (
                  inputB &&
                  inputB.type === 'custom_number' &&
                  getNum(inputB) === 0
                )
                  return true
                return false
              },
              change: function (block: Block) {
                return [{ blockName: 'number', values: { NUM: 0 } }]
              },
            },
            {
              condition: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                const getNum = (b: any) =>
                  typeof b.getFieldValue === 'function'
                    ? Number(b.getFieldValue('NUM'))
                    : typeof b.values === 'object' &&
                        b.values &&
                        typeof b.values.NUM === 'number'
                      ? Number(b.values.NUM)
                      : NaN
                return (
                  inputA && typeof inputA.type === 'string' && inputA.type === 'custom_number' &&
                  inputB && typeof inputB.type === 'string' && inputB.type === 'custom_number' &&
                  !isNaN(getNum(inputA)) &&
                  !isNaN(getNum(inputB))
                )
              },
              change: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                const getNum = (b: any) =>
                  typeof b.getFieldValue === 'function'
                    ? Number(b.getFieldValue('NUM'))
                    : typeof b.values === 'object' &&
                        b.values &&
                        typeof b.values.NUM === 'number'
                      ? Number(b.values.NUM)
                      : NaN
                return [
                  {
                    blockName: 'number',
                    values: {
                      NUM: getNum(inputA) * getNum(inputB),
                    },
                  },
                ]
              },
            },
            {
              condition: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                const getNum = (b: any) =>
                  typeof b.getFieldValue === 'function'
                    ? Number(b.getFieldValue('NUM'))
                    : typeof b.values === 'object' &&
                        b.values &&
                        typeof b.values.NUM === 'number'
                      ? Number(b.values.NUM)
                      : NaN
                return (
                  (inputA &&
                    inputA.type === 'custom_number' &&
                    getNum(inputA) === 1) ||
                  (inputB &&
                    inputB.type === 'custom_number' &&
                    getNum(inputB) === 1)
                )
              },
              change: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                const getNum = (b: any) =>
                  typeof b.getFieldValue === 'function'
                    ? Number(b.getFieldValue('NUM'))
                    : typeof b.values === 'object' &&
                        b.values &&
                        typeof b.values.NUM === 'number'
                      ? Number(b.values.NUM)
                      : NaN
                return getNum(inputA) === 1 ? inputB : inputA
              },
            },
            {
              condition: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                const getNum = (b: any) =>
                  typeof b.getFieldValue === 'function'
                    ? Number(b.getFieldValue('NUM'))
                    : typeof b.values === 'object' &&
                        b.values &&
                        typeof b.values.NUM === 'number'
                      ? Number(b.values.NUM)
                      : NaN
                return (
                  (inputA &&
                    inputA.type === 'custom_number' &&
                    getNum(inputA) === -1) ||
                  (inputB &&
                    inputB.type === 'custom_number' &&
                    getNum(inputB) === -1)
                )
              },
              change: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                const getNum = (b: any) =>
                  typeof b.getFieldValue === 'function'
                    ? Number(b.getFieldValue('NUM'))
                    : typeof b.values === 'object' &&
                        b.values &&
                        typeof b.values.NUM === 'number'
                      ? Number(b.values.NUM)
                      : NaN
                return [
                  {
                    blockName: 'negate',
                    inputs: [getNum(inputA) === -1 ? inputB : inputA],
                  },
                ]
              },
            },
          ],
        },
        subtract: {
          message0: '%1 - %2',
          args0: [
            {
              type: 'input_value',
              name: 'A',
              check: 'Number',
            },
            {
              type: 'input_value',
              name: 'B',
              check: 'Number',
            },
          ],
          output: 'Number',
          inputsInline: true,
          tooltip: 'Subtracts two numbers',
          helpUrl: '',
          jsGenerator: function (block: Block, generator: Generator) {
            const a =
              generator.valueToCode(block, 'A', generator.ORDER_SUBTRACTION) ||
              '0'
            const b =
              generator.valueToCode(block, 'B', generator.ORDER_SUBTRACTION) ||
              '0'
            const code = `${a} - ${b}`
            return [code, generator.ORDER_SUBTRACTION]
          },
          mutations: [
            {
              condition: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                return inputA && inputB && inputA.id === inputB.id
              },
              change: function () {
                return [{ blockName: 'number', values: { NUM: 0 } }]
              },
            },
            {
              condition: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                const getNum = (b: any) =>
                  typeof b.getFieldValue === 'function'
                    ? Number(b.getFieldValue('NUM'))
                    : typeof b.values === 'object' &&
                        b.values &&
                        typeof b.values.NUM === 'number'
                      ? Number(b.values.NUM)
                      : NaN
                if (
                  inputA &&
                  inputA.type === 'custom_number' &&
                  getNum(inputA) === 0
                )
                  return true
                if (
                  inputB &&
                  inputB.type === 'custom_number' &&
                  getNum(inputB) === 0
                )
                  return true
                return false
              },
              change: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                const getNum = (b: any) =>
                  typeof b.getFieldValue === 'function'
                    ? Number(b.getFieldValue('NUM'))
                    : typeof b.values === 'object' &&
                        b.values &&
                        typeof b.values.NUM === 'number'
                      ? Number(b.values.NUM)
                      : NaN
                if (inputA && getNum(inputA) === 0)
                  return [
                    {
                      blockName: 'negate',
                      inputs: [inputB],
                    },
                  ]
                if (inputB && getNum(inputB) === 0) return inputA
                return []
              },
            },
            {
              condition: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                const getNum = (b: any) =>
                  typeof b.getFieldValue === 'function'
                    ? Number(b.getFieldValue('NUM'))
                    : typeof b.values === 'object' &&
                        b.values &&
                        typeof b.values.NUM === 'number'
                      ? Number(b.values.NUM)
                      : NaN
                return !!(
                  inputA &&
                  inputB &&
                  inputA.type === 'custom_number' &&
                  inputB.type === 'custom_number' &&
                  !isNaN(getNum(inputA)) &&
                  !isNaN(getNum(inputB))
                )
              },
              change: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                const getNum = (b: any) =>
                  typeof b.getFieldValue === 'function'
                    ? Number(b.getFieldValue('NUM'))
                    : typeof b.values === 'object' &&
                        b.values &&
                        typeof b.values.NUM === 'number'
                      ? Number(b.values.NUM)
                      : NaN
                const numA = getNum(inputA)
                const numB = getNum(inputB)
                if (isNaN(numA) || isNaN(numB)) return []
                return [
                  {
                    blockName: 'number',
                    values: {
                      NUM: numA - numB,
                    },
                  },
                ]
              },
            },
            {
              condition: function (block: Block) {
                const inputB = getInput(block, 'B')
                return inputB && inputB.type === 'custom_negate'
              },
              change: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                const negatedInner = getInput(inputB, 'INPUT')
                return [
                  {
                    blockName: 'add',
                    inputs: [inputA, negatedInner],
                  },
                ]
              },
            },
          ],
        },
        divide: {
          message0: '%1 / %2',
          args0: [
            {
              type: 'input_value',
              name: 'A',
              check: 'Number',
            },
            {
              type: 'input_value',
              name: 'B',
              check: 'Number',
            },
          ],
          output: 'Number',
          inputsInline: true,
          tooltip: 'Divides two numbers',
          helpUrl: '',
          jsGenerator: function (block: Block, generator: Generator) {
            const a =
              generator.valueToCode(block, 'A', generator.ORDER_DIVISION) || '0'
            const b =
              generator.valueToCode(block, 'B', generator.ORDER_DIVISION) || '1'
            const code = `${a} / ${b}`
            return [code, generator.ORDER_DIVISION]
          },
          mutations: [
            {
              condition: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                return !!(inputA && inputB && inputA.id && inputA.id === inputB.id)
              },
              change: function () {
                return [{ blockName: 'number', values: { NUM: 1 } }]
              },
            },
            {
              condition: function (block: Block) {
                const inputB = getInput(block, 'B')
                return (
                  inputB &&
                  (inputB as any).type === 'custom_number' &&
                  inputB.values &&
                  inputB.values.NUM === 0
                )
              },
              change: function () {
                return [{ blockName: 'number', values: { NUM: NaN } }] // Handle division by zero
              },
            },
            {
              condition: function (block: Block) {
                const inputB = getInput(block, 'B')
                return (
                  inputB &&
                  (inputB as any).type === 'custom_number' &&
                  inputB.values &&
                  inputB.values.NUM === 1
                )
              },
              change: function (block: Block) {
                return [getInput(block, 'A')].filter(Boolean) as Block[]
              },
            },
          ],
        },
        power: {
          message0: '%1 ^ %2',
          args0: [
            {
              type: 'input_value',
              name: 'BASE',
              check: 'Number',
            },
            {
              type: 'input_value',
              name: 'EXPONENT',
              check: 'Number',
            },
          ],
          output: 'Number',
          inputsInline: true,
          tooltip: 'Raises a number to a power',
          helpUrl: '',
          jsGenerator: function (block: Block, generator: Generator) {
            const base =
              generator.valueToCode(
                block,
                'BASE',
                generator.ORDER_EXPONENTIATION,
              ) || '1'
            const exponent =
              generator.valueToCode(
                block,
                'EXPONENT',
                generator.ORDER_EXPONENTIATION,
              ) || '1'
            const code = `Math.pow(${base}, ${exponent})`
            return [code, generator.ORDER_EXPONENTIATION]
          },
          mutations: [
            {
              condition: function (block: Block) {
                const exponent = getInput(block, 'EXPONENT')
                return (
                  exponent &&
                  exponent.type === 'custom_number' &&
                  exponent.values &&
                  exponent.values.NUM === 1
                )
              },
              change: function (block: Block) {
                return [getInput(block, 'BASE')]
              },
            },
            {
              condition: function (block) {
                const exponent = getInput(block, 'EXPONENT')
                return (
                  exponent &&
                  exponent.type === 'custom_number' &&
                  exponent.values &&
                  exponent.values.NUM === 2
                )
              },
              change: function (block: any) {
                return [
                  {
                    blockName: 'multiply',
                    inputs: [getInput(block, 'BASE'), getInput(block, 'BASE')],
                  },
                ]
              },
            },
          ],
        },
        modulo: {
          message0: '%1 % %2',
          args0: [
            {
              type: 'input_value',
              name: 'A',
              check: 'Number',
            },
            {
              type: 'input_value',
              name: 'B',
              check: 'Number',
            },
          ],
          output: 'Number',
          inputsInline: true,
          tooltip: 'Returns the remainder of a division',
          helpUrl: '',
          jsGenerator: function (block: Block, generator: Generator) {
            const a =
              generator.valueToCode(block, 'A', generator.ORDER_MODULUS) || '0'
            const b =
              generator.valueToCode(block, 'B', generator.ORDER_MODULUS) || '1'
            const code = `${a} % ${b}`
            return [code, generator.ORDER_MODULUS]
          },
          mutations: [
            {
              condition: function (block: Block) {
                const inputB = getInput(block, 'B')
                const getNum = (b: any) =>
                  typeof b.getFieldValue === 'function'
                    ? Number(b.getFieldValue('NUM'))
                    : typeof b.values === 'object' &&
                        b.values &&
                        typeof b.values.NUM === 'number'
                      ? Number(b.values.NUM)
                      : NaN
                return (
                  inputB &&
                  inputB.type === 'custom_number' &&
                  getNum(inputB) === 1
                )
              },
              change: function () {
                return [{ blockName: 'number', values: { NUM: 0 } }]
              },
            },
            {
              condition: function (block: any) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                return !!(inputA && inputB && inputA.id && inputA.id === inputB.id)
              },
              change: function () {
                return [{ blockName: 'number', values: { NUM: 0 } }]
              },
            },
          ],
        },
        absolute: {
          message0: 'abs %1',
          args0: [
            {
              type: 'input_value',
              name: 'INPUT',
              check: 'Number',
            },
          ],
          output: 'Number',
          tooltip: 'Returns the absolute value of a number',
          helpUrl: '',
          jsGenerator: function (block: Block, generator: Generator) {
            const input =
              generator.valueToCode(
                block,
                'INPUT',
                generator.ORDER_FUNCTION_CALL,
              ) || '0'
            const code = `Math.abs(${input})`
            return [code, generator.ORDER_FUNCTION_CALL]
          },
          mutations: [
            {
              // Handles both Blockly and program blocks
              condition: function (
                block: Block,
                _state: any,
                _this: Block | undefined,
              ) {
                let input
                if (_this && typeof _this.getInputTargetBlock === 'function') {
                  input = _this.getInputTargetBlock('INPUT')
                } else if (typeof block.getInputTargetBlock === 'function') {
                  input = block.getInputTargetBlock('INPUT')
                } else {
                  input = getInput(block, 'INPUT')
                }
                return input && input.type === 'custom_absolute'
              },
              change: function (
                block: Block,
                _state: any,
                _this: Block | undefined,
              ) {
                let input
                if (_this && typeof _this.getInputTargetBlock === 'function') {
                  input = _this.getInputTargetBlock('INPUT')
                } else if (typeof block.getInputTargetBlock === 'function') {
                  input = block.getInputTargetBlock('INPUT')
                } else {
                  input = getInput(block, 'INPUT')
                }
                let inner
                if (input && typeof input.getInputTargetBlock === 'function') {
                  inner = input.getInputTargetBlock('INPUT')
                } else if (input) {
                  inner = getInput(input, 'INPUT')
                }
                return [
                  {
                    blockName: 'absolute',
                    inputs: [inner],
                  },
                ]
              },
            },
            {
              condition: function (
                block: Block,
                _state: any,
                _this: Block | undefined,
              ) {
                let input
                if (_this && typeof _this.getInputTargetBlock === 'function') {
                  input = _this.getInputTargetBlock('INPUT')
                } else if (typeof block.getInputTargetBlock === 'function') {
                  input = block.getInputTargetBlock('INPUT')
                } else {
                  input = getInput(block, 'INPUT')
                }
                return input && input.type === 'custom_negate'
              },
              change: function (
                block: Block,
                _state: any,
                _this: Block | undefined,
              ) {
                let input
                if (_this && typeof _this.getInputTargetBlock === 'function') {
                  input = _this.getInputTargetBlock('INPUT')
                } else if (typeof block.getInputTargetBlock === 'function') {
                  input = block.getInputTargetBlock('INPUT')
                } else {
                  input = getInput(block, 'INPUT')
                }
                let inner
                if (input && typeof input.getInputTargetBlock === 'function') {
                  inner = input.getInputTargetBlock('INPUT')
                } else if (input) {
                  inner = getInput(input, 'INPUT')
                }
                return [
                  {
                    blockName: 'absolute',
                    inputs: [inner],
                  },
                ]
              },
            },
          ],
        },
        negate: {
          message0: '- %1',
          args0: [
            {
              type: 'input_value',
              name: 'INPUT',
              check: 'Number',
            },
          ],
          output: 'Number',
          tooltip: 'Negates a number',
          helpUrl: '',
          jsGenerator: function (block: Block, generator: Generator) {
            const input =
              generator.valueToCode(
                block,
                'INPUT',
                generator.ORDER_UNARY_NEGATION,
              ) || '0'
            const code = `-${input}`
            return [code, generator.ORDER_UNARY_NEGATION]
          },
          mutations: [
            {
              // Handles both Blockly and program blocks
              condition: function (
                block: Block,
                _state: any,
                _this: Block | undefined,
              ) {
                let input
                if (_this && typeof _this.getInputTargetBlock === 'function') {
                  input = _this.getInputTargetBlock('INPUT')
                } else if (typeof block.getInputTargetBlock === 'function') {
                  input = block.getInputTargetBlock('INPUT')
                } else {
                  input = getInput(block, 'INPUT')
                }
                return input && input.type === 'custom_negate'
              },
              change: function (
                block: Block,
                _state: any,
                _this: Block | undefined,
              ) {
                let input
                if (_this && typeof _this.getInputTargetBlock === 'function') {
                  input = _this.getInputTargetBlock('INPUT')
                } else if (typeof block.getInputTargetBlock === 'function') {
                  input = block.getInputTargetBlock('INPUT')
                } else {
                  input = getInput(block, 'INPUT')
                }
                let inner
                if (input && typeof input.getInputTargetBlock === 'function') {
                  inner = input.getInputTargetBlock('INPUT')
                } else if (input) {
                  inner = getInput(input, 'INPUT')
                }
                return [inner]
              },
            },
          ],
        },
        pi: {
          message0: 'π',
          output: 'Number',
          tooltip: 'The mathematical constant pi',
          helpUrl: '',
          jsGenerator: function () {
            return ['Math.PI', 0]
          },
          mutations: [],
        },
        e: {
          message0: 'e',
          output: 'Number',
          tooltip: 'The mathematical constant e',
          helpUrl: '',
          jsGenerator: function () {
            return ['Math.E', 0]
          },
          mutations: [],
        },
      },
    },
    {
      name: 'Logic',
      colour: 315, // Pink
      blocks: {
        compare: {
          message0: '%1 %2 %3',
          args0: [
            {
              type: 'input_value',
              name: 'A',
              check: 'Number',
            },
            {
              type: 'field_dropdown',
              name: 'OP',
              options: [
                ['=', '=='],
                ['≠', '!='],
                ['>', '>'],
                ['≥', '>='],
                ['<', '<'],
                ['≤', '<='],
              ],
            },
            {
              type: 'input_value',
              name: 'B',
              check: 'Number',
            },
          ],
          output: 'Boolean',
          inputsInline: true,
          tooltip: 'Compares two numbers',
          helpUrl: '',
          jsGenerator: function (block: Block, generator: Generator) {
            const a =
              generator.valueToCode(block, 'A', generator.ORDER_RELATIONAL) ||
              '0'
            const op = block.getFieldValue
              ? block.getFieldValue('OP')
              : undefined
            const b =
              generator.valueToCode(block, 'B', generator.ORDER_RELATIONAL) ||
              '0'
            const code = `${a} ${op} ${b}`
            return [code, generator.ORDER_RELATIONAL]
          },
          mutations: [
            {
              condition: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                return !!(inputA && inputB && inputA.id && inputA.id === inputB.id)
              },
              change: function (block: Block) {
                const op = getFieldValue(block, 'OP')
                return [
                  {
                    blockName: 'boolean',
                    values: {
                      BOOL:
                        op === '==' || op === '>=' || op === '<='
                          ? 'TRUE'
                          : 'FALSE',
                    },
                  },
                ]
              },
            },
          ],
        },
        and: {
          message0: '%1 and %2',
          args0: [
            {
              type: 'input_value',
              name: 'A',
              check: 'Boolean',
            },
            {
              type: 'input_value',
              name: 'B',
              check: 'Boolean',
            },
          ],
          output: 'Boolean',
          inputsInline: true,
          tooltip: 'Returns true if both inputs are true',
          helpUrl: '',
          jsGenerator: function (block: Block, generator: Generator) {
            const a =
              generator.valueToCode(block, 'A', generator.ORDER_LOGICAL_AND) ||
              'false'
            const b =
              generator.valueToCode(block, 'B', generator.ORDER_LOGICAL_AND) ||
              'false'
            const code = `${a} && ${b}`
            return [code, generator.ORDER_LOGICAL_AND]
          },
          mutations: [
            {
              condition: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                return (
                  inputA && inputB && (inputA as any).id === (inputB as any).id
                )
              },
              change: function (block: Block) {
                return [getInput(block, 'A')].filter(Boolean) as Block[]
              },
            },
            {
              condition: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                return (
                  (inputA &&
                    (inputA as any).type === 'custom_boolean' &&
                    inputA.values &&
                    inputA.values.BOOL === 'TRUE') ||
                  (inputB &&
                    (inputB as any).type === 'custom_boolean' &&
                    inputB.values &&
                    inputB.values.BOOL === 'TRUE')
                )
              },
              change: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                return inputA && inputA.values && inputA.values.BOOL === 'TRUE'
                  ? inputB
                  : inputA
              },
            },
            {
              condition: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                return (
                  (inputA &&
                    (inputA as any).type === 'custom_boolean' &&
                    inputA.values &&
                    inputA.values.BOOL === 'FALSE') ||
                  (inputB &&
                    (inputB as any).type === 'custom_boolean' &&
                    inputB.values &&
                    inputB.values.BOOL === 'FALSE')
                )
              },
              change: function () {
                return [{ blockName: 'boolean', values: { BOOL: 'FALSE' } }]
              },
            },
          ],
        },
        or: {
          message0: '%1 or %2',
          args0: [
            {
              type: 'input_value',
              name: 'A',
              check: 'Boolean',
            },
            {
              type: 'input_value',
              name: 'B',
              check: 'Boolean',
            },
          ],
          output: 'Boolean',
          inputsInline: true,
          tooltip: 'Returns true if either input is true',
          helpUrl: '',
          jsGenerator: function (block: Block, generator: Generator) {
            const a =
              generator.valueToCode(block, 'A', generator.ORDER_LOGICAL_OR) ||
              'false'
            const b =
              generator.valueToCode(block, 'B', generator.ORDER_LOGICAL_OR) ||
              'false'
            const code = `${a} || ${b}`
            return [code, generator.ORDER_LOGICAL_OR]
          },
          mutations: [
            {
              condition: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                return !!(inputA && inputB && inputA.id && inputA.id === inputB.id)
              },
              change: function (block: Block) {
                return [getInput(block, 'A')].filter(Boolean) as Block[]
              },
            },
            {
              condition: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                return (
                  (inputA &&
                    inputA.type === 'custom_boolean' &&
                    getFieldValue(inputA, 'BOOL') === 'FALSE') ||
                  (inputB &&
                    inputB.type === 'custom_boolean' &&
                    getFieldValue(inputB, 'BOOL') === 'FALSE')
                )
              },
              change: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                if (!inputA) return [inputB].filter(Boolean) as Block[]
                if (!inputB) return [inputA].filter(Boolean) as Block[]
                const aIsFalse =
                  inputA.type === 'custom_boolean' &&
                  getFieldValue(inputA, 'BOOL') === 'FALSE'
                return (aIsFalse ? [inputB] : [inputA]).filter(
                  Boolean,
                ) as Block[]
              },
            },
            {
              condition: function (block: Block) {
                const inputA = getInput(block, 'A')
                const inputB = getInput(block, 'B')
                return (
                  (inputA &&
                    inputA.type === 'custom_boolean' &&
                    getFieldValue(inputA, 'BOOL') === 'TRUE') ||
                  (inputB &&
                    inputB.type === 'custom_boolean' &&
                    getFieldValue(inputB, 'BOOL') === 'TRUE')
                )
              },
              change: function () {
                return [{ blockName: 'boolean', values: { BOOL: 'TRUE' } }]
              },
            },
          ],
        },
        not: {
          message0: 'not %1',
          args0: [
            {
              type: 'input_value',
              name: 'INPUT',
              check: 'Boolean',
            },
          ],
          output: 'Boolean',
          tooltip: 'Returns the opposite of the input',
          helpUrl: '',
          jsGenerator: function (block: Block, generator: Generator) {
            const input =
              generator.valueToCode(
                block,
                'INPUT',
                generator.ORDER_LOGICAL_OR,
              ) || 'false'
            const code = `!${input}`
            return [code, generator.ORDER_LOGICAL_OR]
          },
          mutations: [
            {
              condition: function (block: Block) {
                const input = getInput(block, 'INPUT')
                return input && (input as any).type === 'custom_not'
              },
              change: function (block: Block) {
                const input = getInput(block, 'INPUT')
                if (input && typeof input === 'object') {
                  const inner = getInput(input, 'INPUT')
                  return inner ? [inner] : []
                }
                return []
              },
            },
          ],
        },
      },
    },
    {
      name: 'Control',
      colour: 31, // Brown
      blocks: {
        if: {
          message0: 'if %1 then %2',
          args0: [
            {
              type: 'input_value',
              name: 'CONDITION',
              check: 'Boolean',
            },
            {
              type: 'input_statement',
              name: 'THEN',
            },
          ],
          previousStatement: null,
          nextStatement: null,
          tooltip: 'Executes actions if a condition is true',
          helpUrl: '',
          jsGenerator: function (block: Block, generator: Generator) {
            const condition =
              generator.valueToCode(
                block,
                'CONDITION',
                generator.ORDER_RELATIONAL,
              ) || 'false'
            const statements = generator.statementToCode(block, 'THEN')
            return `if (${condition}) {\n${statements}}\n`
          },
          mutations: [
            {
              condition: function (block: Block) {
                const conditionBlock = getInput(block, 'CONDITION')
                return (
                  conditionBlock &&
                  conditionBlock.type === 'custom_boolean' &&
                  getFieldValue(conditionBlock, 'BOOL') === 'TRUE'
                )
              },
              change: function (block: Block) {
                if (Array.isArray(block.actions)) {
                  return block.actions
                }
                const thenBlock =
                  typeof block.getInputTargetBlock === 'function'
                    ? block.getInputTargetBlock('THEN')
                    : undefined
                if (thenBlock && typeof thenBlock.getBlocks === 'function') {
                  return thenBlock.getBlocks()
                }
                return []
              },
            },
            {
              condition: function (block: Block) {
                const conditionBlock = getInput(block, 'CONDITION')
                return (
                  conditionBlock &&
                  conditionBlock.type === 'custom_boolean' &&
                  getFieldValue(conditionBlock, 'BOOL') === 'FALSE'
                )
              },
              change: function () {
                return []
              },
            },
          ],
        },
        if_else: {
          message0: 'if %1 then %2 else %3',
          args0: [
            {
              type: 'input_value',
              name: 'CONDITION',
              check: 'Boolean',
            },
            {
              type: 'input_statement',
              name: 'THEN',
            },
            {
              type: 'input_statement',
              name: 'ELSE',
            },
          ],
          previousStatement: null,
          nextStatement: null,
          tooltip:
            'Execute different actions depending on if a condition is true or false',
          helpUrl: '',
          jsGenerator: function (block: Block, generator: Generator) {
            const condition =
              generator.valueToCode(
                block,
                'CONDITION',
                generator.ORDER_RELATIONAL,
              ) || 'false'
            const thenStatements = generator.statementToCode(block, 'THEN')
            const elseStatements = generator.statementToCode(block, 'ELSE')
            return `if (${condition}) {\n${thenStatements}} else {\n${elseStatements}}\n`
          },
          mutations: [],
        },
      },
    },
    {
      name: 'Values',
      colour: 60, // Yellow
      blocks: {
        number: {
          message0: 'number %1',
          args0: [
            {
              type: 'field_number',
              name: 'NUM',
              value: 0,
            },
          ],
          output: 'Number',
          tooltip: 'A number value',
          helpUrl: '',
          jsGenerator: function (block: Block) {
            const num = block.getFieldValue('NUM')
            return [num, 0]
          },
          mutations: [],
        },
        boolean: {
          message0: '%1',
          args0: [
            {
              type: 'field_dropdown',
              name: 'BOOL',
              options: [
                ['true', 'TRUE'],
                ['false', 'FALSE'],
              ],
            },
          ],
          output: 'Boolean',
          tooltip: 'A boolean value',
          helpUrl: '',
          jsGenerator: function (block: Block) {
            const bool =
              block.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false'
            return [bool, 0]
          },
          mutations: [],
        },
      },
    },
    // Functions category will be dynamically handled in Home.tsx
  ],
}
