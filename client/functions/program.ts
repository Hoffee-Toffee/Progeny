// Helper to get live vars at a position (backwards pass, like optimizeDeadStores but returns set per position)
function getLiveVarsAtPositions(
  blocks: Block[],
  inputVariables: string[],
  consoleLog: boolean,
): Set<string>[] {
  const liveAtPos: Set<string>[] = Array(blocks.length + 1)
    .fill(null)
    .map(() => new Set<string>())
  liveAtPos[blocks.length] = new Set(['out']) // Seed with return
  for (let i = blocks.length - 1; i >= 0; i--) {
    const current = blocks[i]
    liveAtPos[i] = new Set(liveAtPos[i + 1])
    if (current.blockName === 'set') {
      const varName = current.var as string
      if (liveAtPos[i + 1].has(varName)) {
        liveAtPos[i].delete(varName)
      }
    }
    const reads = getReferencedVariables(current, inputVariables, consoleLog)
    reads.forEach((v) => liveAtPos[i].add(v))
  }
  return liveAtPos
}
import blocksModule, { Block } from '../files/blocks'
import { log, warn, error } from './logger.js'

// Flatten block definitions for fast lookup
const blockDefs: { [key: string]: BlockDefinition } = (() => {
  const defs: { [key: string]: BlockDefinition } = {}
  for (const cat of (blocksModule as any).categories || []) {
    for (const [blockName, def] of Object.entries(cat.blocks || {})) {
      defs[blockName] = def as BlockDefinition
    }
  }
  return defs
})()

// Valid variables and constants
const variables: string[] = ['out', 'v0', 'v1', 'v2']
const constants: number[] = [-10, -5, -1, 0, 1, 2, 5, 10, 0.1, 0.5, 1.0, 2.0]
const booleanConstants: boolean[] = [true, false]
const operators: string[] = ['==', '!=', '>', '>=', '<', '<=']

interface BlockDefinition {
  inputs?: string[]
  output?: 'Number' | 'Boolean'
  action?: (
    ...args: (string | number | boolean | Block)[]
  ) => number | boolean | void
  mutations?: Array<{
    condition?: (block: Block) => boolean
    change: (block: Block) => Block | Block[] | []
  }>
  expand?: (block: Block) => Block | Block[]
}

interface State {
  vars: { [key: string]: number | boolean }
  output: number
}

// Helper function for validating variable names
function isValidProgramVariableName(
  varName: string,
  localInputVariables: string[],
): boolean {
  if (typeof varName !== 'string' || varName.trim() === '') return false
  if (variables.includes(varName) || localInputVariables.includes(varName)) {
    return true
  }
  const dynamicVarPattern = /^(out|v[0-9]+|b[0-9]+)$/
  return dynamicVarPattern.test(varName)
}

// Helper to get all variables referenced/read by a value or block component
function getReferencedVariables(
  valueOrBlock: string | number | boolean | Block | null | undefined,
  inputVariables: string[],
  consoleLog = false,
): Set<string> {
  const referenced: Set<string> = new Set()

  if (valueOrBlock === null || valueOrBlock === undefined) {
    return referenced
  }

  if (typeof valueOrBlock === 'number' || typeof valueOrBlock === 'boolean') {
    return referenced
  }

  if (typeof valueOrBlock === 'string') {
    if (isValidProgramVariableName(valueOrBlock, inputVariables)) {
      referenced.add(valueOrBlock)
    }
    return referenced
  }

  const block = valueOrBlock as Block
  if (!block.blockName) {
    return referenced
  }

  switch (block.blockName) {
    case 'get':
      if (
        block.inputs &&
        typeof block.inputs[0] === 'string' &&
        isValidProgramVariableName(block.inputs[0], inputVariables)
      ) {
        referenced.add(block.inputs[0])
      }
      break
    case 'set':
      if ('value' in block) {
        const valueVars = getReferencedVariables(
          block.value,
          inputVariables,
          consoleLog,
        )
        valueVars.forEach((v) => referenced.add(v))
      }
      break
    case 'if':
    case 'ifElse':
      if ('condition' in block) {
        const conditionVars = getReferencedVariables(
          block.condition,
          inputVariables,
          consoleLog,
        )
        conditionVars.forEach((v) => referenced.add(v))
      }
      break
    case 'return':
      if (block.inputs && block.inputs.length > 0) {
        const returnInputVars = getReferencedVariables(
          block.inputs[0],
          inputVariables,
          consoleLog,
        )
        returnInputVars.forEach((v) => referenced.add(v))
      }
      break
    default:
      if (block.inputs && Array.isArray(block.inputs)) {
        block.inputs.forEach((input) => {
          const inputVars = getReferencedVariables(
            input,
            inputVariables,
            consoleLog,
          )
          inputVars.forEach((v) => referenced.add(v))
        })
      }
      break
  }
  return referenced
}

function isValidValue(
  value: string | number | boolean | Block | null | undefined,
  expectedType: string,
  inputVariables: string[] = [],
  consoleLog = false,
): boolean {
  if (value === null || value === undefined) return false
  if (expectedType === 'number') {
    if (typeof value === 'number') return true
    if (
      typeof value === 'string' &&
      (variables.includes(value) || inputVariables.includes(value))
    )
      return true
    if (
      typeof value === 'object' &&
      value.blockName &&
      isValidBlock(value, inputVariables, consoleLog)
    ) {
      if (blockDefs[value.blockName]?.output === 'Number') return true
      if (value.blockName === 'get') {
        const varName = value.inputs && value.inputs[0]
        if (
          typeof varName === 'string' &&
          isValidProgramVariableName(varName, inputVariables) &&
          !varName.startsWith('b')
        )
          return true
      }
    }
  }
  if (expectedType === 'boolean') {
    if (typeof value === 'boolean') return true
    if (
      typeof value === 'string' &&
      isValidProgramVariableName(value, inputVariables)
    )
      return true
    if (
      typeof value === 'object' &&
      value.blockName &&
      isValidBlock(value, inputVariables, consoleLog)
    ) {
      if (blockDefs[value.blockName]?.output === 'Boolean') return true
      if (value.blockName === 'get') {
        const varName = value.inputs && value.inputs[0]
        if (
          typeof varName === 'string' &&
          isValidProgramVariableName(varName, inputVariables) &&
          varName.startsWith('b')
        )
          return true
      }
    }
  }
  if (expectedType === 'variable') {
    return isValidProgramVariableName(value as string, inputVariables)
  }
  if (
    expectedType === "'=='|'!='|'>'|'>='|'<'|'<='" &&
    operators.includes(value as string)
  )
    return true
  return false
}

function isValidBlock(
  block: Block,
  inputVariables: string[] = [],
  consoleLog = false,
): block is Block {
  if (!block || typeof block !== 'object' || !block.blockName) {
    throw new Error(
      `Validation Error: Block is missing a name or is not an object: ${JSON.stringify(block)}`,
    )
  }

  if (block.blockName === 'set') {
    const varName = block.var ?? ''
    if (!isValidProgramVariableName(varName as string, inputVariables)) {
      throw new Error(
        `Validation Error: set block has invalid or missing 'var' property: '${varName}'. Block: ${JSON.stringify(block)}`,
      )
    }

    if (
      !isValidValue(
        block.value,
        varName.startsWith('b') ? 'boolean' : 'number',
        inputVariables,
        consoleLog,
      )
    ) {
      throw new Error(
        `Validation Error: set block has invalid 'value' for var '${varName}': ${JSON.stringify(block)}`,
      )
    }
    return true
  }

  if (block.blockName === 'return') {
    if (
      !block.inputs ||
      !Array.isArray(block.inputs) ||
      block.inputs.length !== 1
    ) {
      throw new Error(
        `Validation Error: return block must have exactly one input. Block: ${JSON.stringify(block)}`,
      )
    }
    if (!isValidValue(block.inputs[0], 'number', inputVariables, consoleLog)) {
      throw new Error(
        `Validation Error: return block's input is not a valid number. Block: ${JSON.stringify(block)}`,
      )
    }
    return true
  }

  if (block.blockName === 'if' || block.blockName === 'ifElse') {
    if (!isValidValue(block.condition, 'boolean', inputVariables, consoleLog)) {
      throw new Error(
        `Validation Error: ${block.blockName} has invalid condition. Block: ${JSON.stringify(block)}`,
      )
    }
    if (
      !Array.isArray(block.actions) ||
      !block.actions.every((a: Block) =>
        isValidBlock(a, inputVariables, consoleLog),
      )
    ) {
      throw new Error(
        `Validation Error: ${block.blockName} has invalid actions. Block: ${JSON.stringify(block)}`,
      )
    }
    if (
      block.blockName === 'ifElse' &&
      (!Array.isArray(block.elseActions) ||
        !block.elseActions.every((a: Block) =>
          isValidBlock(a, inputVariables, consoleLog),
        ))
    ) {
      throw new Error(
        `Validation Error: ifElse has invalid elseActions. Block: ${JSON.stringify(block)}`,
      )
    }
    return true
  }

  const blockDef = blockDefs[block.blockName || '']
  if (!blockDef) {
    throw new Error(
      `Validation Error: Unknown blockName '${block.blockName}'. Block: ${JSON.stringify(block)}`,
    )
  }

  if (blockDef.inputs) {
    if (
      !Array.isArray(block.inputs) ||
      block.inputs.length !== blockDef.inputs.length
    ) {
      throw new Error(
        `Validation Error: Incorrect inputs array for ${block.blockName}, expected ${blockDef.inputs.length}, got ${block.inputs?.length || 0}. Block: ${JSON.stringify(block)}`,
      )
    }
    for (let i = 0; i < blockDef.inputs.length; i++) {
      if (
        !isValidValue(
          block.inputs[i],
          blockDef.inputs[i],
          inputVariables,
          consoleLog,
        )
      ) {
        throw new Error(
          `Validation Error: Input ${i} ('${blockDef.inputs[i]}') for ${block.blockName} is invalid. Block: ${JSON.stringify(block)}`,
        )
      }
    }
  } else if (block.inputs && block.inputs.length > 0) {
    throw new Error(
      `Validation Error: ${block.blockName} does not expect inputs, but instance has them. Block: ${JSON.stringify(block)}`,
    )
  }

  return true
}

async function generateInput(
  type: string,
  depth: number,
  maxDepth: number,
  inputVariables: string[],
  consoleLog: boolean,
): Promise<string | number | boolean | Block> {
  let returnValue: string | number | boolean | Block = 0

  if (depth >= maxDepth) {
    if (type === 'number') {
      await log(
        `Depth ${depth}: Hit recursion limit for number type '${type}'`,
        consoleLog,
      )
      returnValue =
        inputVariables.length > 0
          ? inputVariables[Math.floor(Math.random() * inputVariables.length)]
          : constants[Math.floor(Math.random() * constants.length)]
    } else if (type === 'boolean') {
      returnValue =
        booleanConstants[Math.floor(Math.random() * booleanConstants.length)]
    } else if (type === 'variable') {
      returnValue = variables[Math.floor(Math.random() * variables.length)]
    } else if (type === "'=='|'!='|'>'|'>='|'<'|'<='") {
      returnValue = operators[Math.floor(Math.random() * operators.length)]
    } else {
      warn(
        `generateInput: Unknown type '${type}' at max depth ${depth}. Defaulting to 0.`,
        consoleLog,
      )
      returnValue = 0
    }
  } else if (type === 'number') {
    if (Math.random() < 0.6 && inputVariables.length > 0) {
      const stringValue =
        inputVariables[Math.floor(Math.random() * inputVariables.length)]
      await log(
        `Depth ${depth}: Generated number (from input var) ${stringValue}`,
        consoleLog,
      )
      returnValue = stringValue
    } else if (Math.random() < 0.3) {
      const generatedBlock = await ProgenyProgram.generateRandomBlock(
        depth + 1,
        maxDepth,
        false,
        null,
        inputVariables,
        consoleLog,
      )
      if (typeof generatedBlock === 'object' && generatedBlock !== null) {
        if (
          !generatedBlock.blockName ||
          !isValidBlock(generatedBlock, inputVariables, true)
        ) {
          warn(
            `generateInput (for number): generateRandomBlock returned invalid block: ${JSON.stringify(generatedBlock)}. Defaulting to constant.`,
            consoleLog,
          )
          returnValue = constants[Math.floor(Math.random() * constants.length)]
        } else {
          returnValue = generatedBlock
        }
      } else {
        warn(
          `generateInput (for number): generateRandomBlock returned non-object: ${JSON.stringify(generatedBlock)}. Defaulting to constant.`,
          consoleLog,
        )
        returnValue = constants[Math.floor(Math.random() * constants.length)]
      }
    } else {
      returnValue = constants[Math.floor(Math.random() * constants.length)]
    }
  } else if (type === 'boolean') {
    if (Math.random() < 0.1) {
      const boolBlock = await ProgenyProgram.generateRandomBlock(
        depth + 1,
        maxDepth,
        false,
        null,
        inputVariables,
        consoleLog,
      )
      if (typeof boolBlock === 'object' && boolBlock !== null) {
        if (
          !boolBlock.blockName ||
          !isValidBlock(boolBlock, inputVariables, true) ||
          blockDefs[boolBlock.blockName]?.output !== 'boolean'
        ) {
          returnValue =
            booleanConstants[
              Math.floor(Math.random() * booleanConstants.length)
            ]
        } else {
          returnValue = boolBlock
        }
      } else {
        returnValue =
          booleanConstants[Math.floor(Math.random() * booleanConstants.length)]
      }
    } else {
      returnValue =
        booleanConstants[Math.floor(Math.random() * booleanConstants.length)]
    }
  } else if (type === 'variable') {
    returnValue = variables[Math.floor(Math.random() * variables.length)]
  } else if (type === "'=='|'!='|'>'|'>='|'<'|'<='") {
    returnValue = operators[Math.floor(Math.random() * operators.length)]
  } else {
    warn(
      `generateInput: Unknown type '${type}' (not max depth). Defaulting to 0.`,
      consoleLog,
    )
    returnValue = 0
  }

  if (typeof returnValue === 'object') {
    if (
      !returnValue.blockName ||
      !isValidBlock(returnValue, inputVariables, true)
    ) {
      warn(
        `generateInput for type '${type}': Returning object is invalid: ${JSON.stringify(returnValue)}. Defaulting based on type.`,
        consoleLog,
      )
      if (type === 'number')
        return constants[Math.floor(Math.random() * constants.length)]
      if (type === 'boolean')
        return booleanConstants[
          Math.floor(Math.random() * booleanConstants.length)
        ]
      return 0
    }
  }

  return returnValue
}

// Fix generateInitialValue return type
async function generateInitialValue(
  inputVariables: string[],
  depth: number,
  maxDepth: number,
  consoleLog: boolean,
): Promise<string | number | Block> {
  if (Math.random() < 0.7 && inputVariables.length >= 2) {
    const innerAdd: Block = {
      blockName: 'add',
      inputs: [
        inputVariables[Math.floor(Math.random() * inputVariables.length)],
        inputVariables[Math.floor(Math.random() * inputVariables.length)],
      ],
    }
    const outerAdd: Block = {
      blockName: 'add',
      inputs: [
        innerAdd,
        inputVariables[Math.floor(Math.random() * inputVariables.length)],
      ],
    }
    await log(
      `Depth ${depth}: Generated nested add block ${JSON.stringify(outerAdd)}`,
      consoleLog,
    )
    return outerAdd
  }
  // Only return string | number | Block, never boolean
  const val = await generateInput(
    'number',
    depth,
    maxDepth,
    inputVariables,
    consoleLog,
  )
  if (typeof val === 'boolean') {
    // fallback to 0 if boolean (should not happen)
    return 0
  }
  return val
}

export class ProgenyProgram {
  inputVariables: string[]
  consoleLog: boolean
  blocks: Block[]

  constructor(
    initialBlocks: Block[],
    inputVariables: string[] = [],
    consoleLog = false,
    parents: string[] = [],
  ) {
    this.inputVariables = inputVariables
    this.consoleLog = consoleLog
    let processedBlocks: Block[] = []
    if (initialBlocks && initialBlocks.length > 0) {
      processedBlocks = initialBlocks.filter((block) => {
        const isValid = isValidBlock(
          block,
          this.inputVariables,
          this.consoleLog,
        )
        if (!isValid) {
          warn(
            `Invalid block provided to constructor, filtering out: ${JSON.stringify(block)}`,
            this.consoleLog,
          )
        }
        return isValid
      })
    }
    if (processedBlocks.length === 0) {
      warn(
        `Constructor received no valid blocks, creating ultra-simple sync default.`,
        this.consoleLog,
      )
      processedBlocks = [
        {
          blockName: 'set',
          var: 'out',
          value:
            this.inputVariables.length > 0
              ? this.inputVariables[0]
              : constants[0],
        },
        { blockName: 'return', inputs: ['out'] },
      ]
    }
    this.blocks =
      processedBlocks.length === 0
        ? [
            {
              blockName: 'set',
              var: 'out',
              value:
                this.inputVariables.length > 0
                  ? this.inputVariables[0]
                  : constants[0],
            },
            { blockName: 'return', inputs: ['out'] },
          ]
        : processedBlocks
    if (!this.blocks.some((b) => b.blockName === 'return')) {
      this.blocks.push({ blockName: 'return', inputs: ['out'] })
      warn(`Appended default return block in constructor.`, this.consoleLog)
    }
    if (
      !this.blocks.every((block) =>
        isValidBlock(block, this.inputVariables, this.consoleLog),
      )
    ) {
      warn(
        `CRITICAL: Blocks in constructor are still invalid after processing and defaults: ${JSON.stringify(this.blocks)}. This should not happen.`,
        this.consoleLog,
      )
      this.blocks = [
        {
          blockName: 'set',
          var: 'out',
          value: constants[0],
        },
        { blockName: 'return', inputs: ['out'] },
      ]
    }
  }

  static async create(
    initialBlocks: Block[] = [],
    inputVariables: string[] = [],
    consoleLog = false,
  ): Promise<ProgenyProgram> {
    let blocksToConstruct: Block[]

    if (initialBlocks && initialBlocks.length > 0) {
      blocksToConstruct = initialBlocks
    } else {
      const defaultValue = await generateInitialValue(
        inputVariables,
        0,
        2,
        consoleLog,
      )
      blocksToConstruct = [
        {
          blockName: 'set',
          var: 'out',
          value: defaultValue,
        },
        {
          blockName: 'return',
          inputs: ['out'],
        },
      ]
    }
    return new ProgenyProgram(blocksToConstruct, inputVariables, consoleLog)
  }

  async resolveInput(
    input: string | number | boolean | Block,
    inputs: { [key: string]: number | boolean },
    state: State,
    expectedType: string,
  ): Promise<string | number | boolean> {
    if (input === null || input === undefined) {
      await warn(`Null or undefined input for ${expectedType}`, this.consoleLog)
      return expectedType === 'boolean' ? false : 0
    }
    if (typeof input === 'number' && expectedType === 'number') return input
    if (typeof input === 'boolean' && expectedType === 'boolean') return input
    if (typeof input === 'string') {
      if (expectedType === 'variable') {
        return variables.includes(input) || this.inputVariables.includes(input)
          ? input
          : variables[0]
      }
      if (expectedType === 'number' || expectedType === 'boolean') {
        const value = state.vars[input]
        if (value === undefined) {
          await warn(
            `Undefined variable ${input} for ${expectedType}`,
            this.consoleLog,
          )
          return expectedType === 'boolean' ? false : 0
        }
        if (
          (expectedType === 'number' && typeof value === 'number') ||
          (expectedType === 'boolean' && typeof value === 'boolean')
        ) {
          return value
        }
        await warn(
          `Type mismatch for ${input}: expected ${expectedType}, got ${typeof value}`,
          this.consoleLog,
        )
        return expectedType === 'boolean' ? false : 0
      }
      if (expectedType === "'=='|'!='|'>'|'>='|'<'|'<='") {
        return operators.includes(input) ? input : '=='
      }
    }
    if (
      typeof input === 'object' &&
      isValidBlock(input, this.inputVariables, this.consoleLog)
    ) {
      const blockDef = blockDefs[input.blockName || '']
      if (blockDef?.output === 'number' && expectedType === 'number') {
        const result = await this.executeBlock(input, inputs, state)
        if (typeof result === 'number' || typeof result === 'boolean') {
          return result
        }
        return 0
      }
      if (blockDef?.output === 'boolean' && expectedType === 'boolean') {
        const result = await this.executeBlock(input, inputs, state)
        if (typeof result === 'number' || typeof result === 'boolean') {
          return result
        }
        return 0
      }
      if (input.blockName === 'get' && expectedType === 'number') {
        const key = input.inputs && input.inputs[0]
        if (
          !key ||
          !(
            variables.includes(key as string) ||
            this.inputVariables.includes(key as string)
          )
        ) {
          await warn(
            `Invalid variable for get: ${key || 'undefined'} in block ${JSON.stringify(input)}`,
            this.consoleLog,
          )
          return 0
        }
        const value = state.vars[key as string]
        if (typeof value === 'number') {
          return value
        }
        await warn(
          `Type mismatch for get(${key}): expected number, got ${typeof value}`,
          this.consoleLog,
        )
        return 0
      }
      if (input.blockName === 'get' && expectedType === 'boolean') {
        const key = input.inputs && input.inputs[0]
        if (
          !key ||
          !(
            variables.includes(key as string) ||
            this.inputVariables.includes(key as string)
          )
        ) {
          await warn(
            `Invalid variable for get: ${key || 'undefined'} in block ${JSON.stringify(input)}`,
            this.consoleLog,
          )
          return false
        }
        const value = state.vars[key as string]
        if (typeof value === 'boolean') {
          return value
        }
        await warn(
          `Type mismatch for get(${key}): expected boolean, got ${typeof value}`,
          this.consoleLog,
        )
        return false
      }
    }
    await warn(
      `Invalid input for ${expectedType}: ${JSON.stringify(input)} (type: ${typeof input})`,
      this.consoleLog,
    )
    return expectedType === 'boolean' ? false : 0
  }

  async executeBlock(
    block: Block,
    runTimeInputs: { [key: string]: number | boolean },
    state: State,
  ): Promise<void | number | boolean> {
    if (!isValidBlock(block, this.inputVariables, this.consoleLog)) {
      await warn(
        `Executing invalid block: ${JSON.stringify(block)}`,
        this.consoleLog,
      )
      return 0
    }

    const blockName = block.blockName

    if (blockName === 'set') {
      if (typeof block.var === 'string') {
        const varType = block.var.startsWith('b') ? 'boolean' : 'number'
        const resolved = await this.resolveInput(
          block.value,
          runTimeInputs,
          state,
          varType,
        )
        if (typeof resolved === 'number' || typeof resolved === 'boolean') {
          state.vars[block.var] = resolved
        }
      }
      return
    }

    if (blockName === 'return') {
      if (block.inputs && block.inputs.length > 0) {
        const valueToReturn = await this.resolveInput(
          block.inputs[0],
          runTimeInputs,
          state,
          'number',
        )
        if (typeof valueToReturn === 'number') {
          state.output = valueToReturn
        }
      }
      return
    }

    if (blockName === 'if') {
      const condition = await this.resolveInput(
        block.condition,
        runTimeInputs,
        state,
        'boolean',
      )
      if (condition) {
        for (const action of block.actions || []) {
          await this.executeBlock(action, runTimeInputs, state)
        }
      }
      return
    }

    if (blockName === 'ifElse') {
      const condition = await this.resolveInput(
        block.condition,
        runTimeInputs,
        state,
        'boolean',
      )
      const actionsToExecute = condition
        ? block.actions || []
        : block.elseActions || []
      for (const action of actionsToExecute) {
        await this.executeBlock(action, runTimeInputs, state)
      }
      return
    }

    const blockDef = blockDefs[blockName || '']

    if (!blockDef?.output) {
      await error(
        `Block '${blockName}' from blockDefs has no 'output' and is not a handled special block. Executing its action if available.`,
        this.consoleLog,
      )
      if (blockDef?.action && typeof blockDef.action === 'function') {
        const resolvedInputsForStackAction = block.inputs
          ? await Promise.all(
              block.inputs.map((input, i) =>
                this.resolveInput(
                  input,
                  runTimeInputs,
                  state,
                  blockDef.inputs && blockDef.inputs[i]
                    ? blockDef.inputs[i]
                    : '',
                ),
              ),
            )
          : []
        blockDef.action(...resolvedInputsForStackAction, state)
      }
      return
    }

    let resolvedInputs: (string | number | boolean)[] = []
    if (blockDef.inputs) {
      if (Array.isArray(block.inputs)) {
        resolvedInputs = await Promise.all(
          block.inputs.map((input, i) =>
            this.resolveInput(
              input,
              runTimeInputs,
              state,
              blockDef.inputs && blockDef.inputs[i] ? blockDef.inputs[i] : '',
            ),
          ),
        )
      }
    } else if (block.inputs && block.inputs.length > 0) {
      await error(
        `Block '${blockName}' instance has inputs, but definition does not. Inputs ignored. Block: ${JSON.stringify(block)}`,
        this.consoleLog,
      )
    }

    if (typeof blockDef.action === 'function') {
      return blockDef.action(...resolvedInputs, state)
    } else {
      if (resolvedInputs.length > 0 && typeof blockDef.action !== 'function') {
        await error(
          `Block '${blockName}' has inputs but no action function.`,
          this.consoleLog,
        )
        return blockDef.output === 'boolean' ? false : 0
      }
    }
  }

  async run(runTimeInputs: {
    [key: string]: number | boolean
  }): Promise<number> {
    const initialVars: { [key: string]: number | boolean } = {
      out: 0,
      v0: 0,
      v1: 0,
      v2: 0,
    }

    for (const varName of this.inputVariables) {
      if (Object.prototype.hasOwnProperty.call(runTimeInputs, varName)) {
        initialVars[varName] = runTimeInputs[varName]
      } else {
        initialVars[varName] = 0
        warn(
          `Input variable '${varName}' not provided in runTimeInputs, defaulting to 0.`,
          this.consoleLog,
        )
      }
    }

    const state: State = {
      vars: initialVars,
      output: 0,
    }

    for (const block of this.blocks) {
      if (isValidBlock(block, this.inputVariables, this.consoleLog)) {
        await this.executeBlock(block, runTimeInputs, state)
      }
    }
    return state.output
  }

  static async generateRandomBlock(
    depth = 0,
    maxDepth = 2,
    isAction = false,
    targetVar: string | null = null,
    inputVariables: string[] = [],
    consoleLog = false,
  ): Promise<Block> {
    const blockTypes = isAction
      ? Object.keys(blockDefs).filter(
          (t) => !blockDefs[t]?.output && t !== 'return' && t !== 'set',
        )
      : Object.keys(blockDefs).filter(
          (t) =>
            blockDefs[t]?.output === 'Number' && t !== 'get' && t !== 'return',
        )
    const blockName = blockTypes[Math.floor(Math.random() * blockTypes.length)]
    const blockDef = blockDefs[blockName]
    const block: Block = { blockName }

    if (blockName === 'set') {
      block.var =
        targetVar || variables[Math.floor(Math.random() * variables.length)]
      const expectedValueType = block.var.startsWith('b') ? 'boolean' : 'number'
      block.value = await generateInput(
        expectedValueType,
        depth + 1,
        maxDepth,
        inputVariables,
        consoleLog,
      )
      if (
        !isValidValue(
          block.value,
          expectedValueType,
          inputVariables,
          consoleLog,
        )
      ) {
        await warn(
          `Invalid value for set block (expected ${expectedValueType}): ${JSON.stringify(block.value)}`,
          consoleLog,
        )
        if (expectedValueType === 'boolean') {
          block.value =
            booleanConstants[
              Math.floor(Math.random() * booleanConstants.length)
            ]
        } else {
          block.value =
            inputVariables.length > 0 && typeof inputVariables[0] === 'string'
              ? inputVariables[0]
              : constants[0]
        }
      }
    } else if (blockDef.inputs) {
      block.inputs = await Promise.all(
        blockDef.inputs.map(async (inputType) => {
          const input = await generateInput(
            inputType,
            depth + 1,
            maxDepth,
            inputVariables,
            consoleLog,
          )
          if (!isValidValue(input, inputType, inputVariables, consoleLog)) {
            await warn(
              `Invalid input for ${blockName}: ${JSON.stringify(input)}`,
              consoleLog,
            )
            return inputType === 'number'
              ? constants[0]
              : inputType === 'boolean'
                ? false
                : variables[0]
          }
          return input
        }),
      )
    }

    if (!isValidBlock(block, inputVariables, consoleLog)) {
      await warn(
        `Generated invalid block ${JSON.stringify(block)} at depth ${depth}`,
        consoleLog,
      )
      return {
        blockName: 'set',
        var: targetVar || variables[0],
        value: inputVariables.length > 0 ? inputVariables[0] : constants[0],
      }
    }
    await log(
      `Depth ${depth}: Generated block ${blockName} ${block.inputs ? 'with inputs ' + JSON.stringify(block.inputs) : ''}${block.var ? ' var ' + block.var : ''}${block.value ? ' value ' + JSON.stringify(block.value) : ''}`,
      consoleLog,
    )
    return block
  }

  async mutate(): Promise<void> {
    const newBlocks: Block[] = [...this.blocks]
    const liveVarsAtPos = getLiveVarsAtPositions(
      newBlocks,
      this.inputVariables,
      this.consoleLog,
    )
    const mutationType = Math.random()
    // Value mutation: mutate a value in a random set block (keep as before, but if set, ensure var is live somewhere)
    if (mutationType < 0.25) {
      const setBlocks = newBlocks.filter((b) => b.blockName === 'set')
      if (setBlocks.length > 0) {
        const idx = Math.floor(Math.random() * setBlocks.length)
        const setBlock = setBlocks[idx]
        setBlock.value = await generateInitialValue(
          this.inputVariables,
          0,
          2,
          this.consoleLog,
        )
      }
    } else if (mutationType < 0.4) {
      // Block replacement (preventative: new block must not create dead if set)
      if (newBlocks.length > 1) {
        const idx = Math.floor(Math.random() * (newBlocks.length - 1))
        let newBlock = await ProgenyProgram.generateRandomBlock(
          0,
          2,
          false,
          null,
          this.inputVariables,
          this.consoleLog,
        )
        if (newBlock.blockName === 'set') {
          const liveAfter = liveVarsAtPos[idx + 1]
          if (liveAfter.size > 0) {
            newBlock.var =
              Array.from(liveAfter)[Math.floor(Math.random() * liveAfter.size)]
          } else {
            newBlock = { blockName: 'return', inputs: ['out'] }
          }
        }
        if (isValidBlock(newBlock, this.inputVariables, this.consoleLog)) {
          newBlocks[idx] = newBlock
        }
      }
    } else if (mutationType < 0.55) {
      // Block addition (preventative: insert at pos where effect is live)
      const insertIdx = Math.floor(Math.random() * newBlocks.length)
      const newBlock = await ProgenyProgram.generateRandomBlock(
        0,
        2,
        false,
        null,
        this.inputVariables,
        this.consoleLog,
      )
      if (newBlock.blockName === 'set') {
        const liveAfter = liveVarsAtPos[insertIdx]
        if (liveAfter.size > 0 && Math.random() < 0.9) {
          newBlock.var =
            Array.from(liveAfter)[Math.floor(Math.random() * liveAfter.size)]
        } else {
          // Introduce new var (e.g., v3), force use: find later number/boolean input, replace with get new_var
          const usedVars = this.blocks.reduce(
            (acc, b) => (b.var ? { ...acc, [b.var]: true } : acc),
            {} as Record<string, boolean>,
          )
          const newVar = `v${Object.keys(usedVars).length + 1}`
          newBlock.var = newVar
          // Find a later position to insert use
          for (let k = insertIdx; k < newBlocks.length; k++) {
            const laterBlock = newBlocks[k]
            const reporter = findReporterBlock(laterBlock)
            if (reporter && Math.random() < 0.5) {
              const newGet = { blockName: 'get', inputs: [newVar] }
              replaceReporterBlock(laterBlock, reporter.path, newGet)
              break
            }
          }
        }
      }
      if (isValidBlock(newBlock, this.inputVariables, this.consoleLog)) {
        newBlocks.splice(insertIdx, 0, newBlock)
      }
    } else if (mutationType < 0.7) {
      // Removal (preventative: skip if removes used var)
      if (newBlocks.length > 2) {
        const idx = Math.floor(Math.random() * (newBlocks.length - 1))
        const toRemove = newBlocks[idx]
        if (
          toRemove.blockName === 'set' &&
          liveVarsAtPos[idx + 1].has(toRemove.var as string)
        ) {
          // Skip if live
        } else {
          newBlocks.splice(idx, 1)
        }
      }
    } else if (mutationType < 0.85) {
      // Block shuffling: swap two non-return blocks
      if (newBlocks.length > 2) {
        const idx1 = Math.floor(Math.random() * (newBlocks.length - 1))
        let idx2 = Math.floor(Math.random() * (newBlocks.length - 1))
        while (idx2 === idx1 && newBlocks.length > 3) {
          idx2 = Math.floor(Math.random() * (newBlocks.length - 1))
        }
        const tmp = newBlocks[idx1]
        newBlocks[idx1] = newBlocks[idx2]
        newBlocks[idx2] = tmp
      }
    } else if (mutationType < 0.93) {
      // Per-block mutation: try to apply a mutation from the block's 'mutations' array
      const candidateIdxs = newBlocks
        .map((b, i) => (b.blockName !== 'return' ? i : -1))
        .filter((i) => i >= 0)
      if (candidateIdxs.length > 0) {
        const idx =
          candidateIdxs[Math.floor(Math.random() * candidateIdxs.length)]
        const block = newBlocks[idx]
        const blockDef = blockDefs[block.blockName || '']
        if (
          blockDef &&
          Array.isArray(blockDef.mutations) &&
          blockDef.mutations.length > 0
        ) {
          const possible = blockDef.mutations.filter((m) =>
            typeof m.condition === 'function' ? m.condition(block) : true,
          )
          if (possible.length > 0) {
            const mutation =
              possible[Math.floor(Math.random() * possible.length)]
            if (typeof mutation.change === 'function') {
              const result = mutation.change(block)
              if (Array.isArray(result)) {
                newBlocks.splice(idx, 1, ...result)
              } else if (result) {
                newBlocks[idx] = result
              }
            }
          }
        }
      }
    } else {
      // Expansion: try to expand a random block using its 'expand' property
      const candidateIdxs = newBlocks
        .map((b, i) => (b.blockName !== 'return' ? i : -1))
        .filter((i) => i >= 0)
      if (candidateIdxs.length > 0) {
        const idx =
          candidateIdxs[Math.floor(Math.random() * candidateIdxs.length)]
        const block = newBlocks[idx]
        const blockDef = blockDefs[block.blockName || '']
        if (blockDef && typeof blockDef.expand === 'function') {
          const expanded = blockDef.expand(block)
          if (Array.isArray(expanded)) {
            newBlocks.splice(idx, 1, ...expanded)
          } else if (expanded) {
            newBlocks[idx] = expanded
          }
        }
      }
    }
    // Always ensure at least a return block
    if (!newBlocks.some((b) => b.blockName === 'return')) {
      newBlocks.push({ blockName: 'return', inputs: ['out'] })
    }
    this.blocks = newBlocks.filter((block) =>
      isValidBlock(block, this.inputVariables, this.consoleLog),
    )
    // No optimizeDeadStores here
    if (
      this.blocks.length === 0 ||
      !this.blocks.some((b) => b.blockName === 'return')
    ) {
      await warn(
        `Reset to default blocks after mutation: ${JSON.stringify(this.blocks)}`,
        this.consoleLog,
      )
      this.blocks = [
        {
          blockName: 'set',
          var: 'out',
          value: await generateInitialValue(
            this.inputVariables,
            0,
            2,
            this.consoleLog,
          ),
        },
        {
          blockName: 'return',
          inputs: ['out'],
        },
      ]
    }
    if (
      !this.blocks.every((block) =>
        isValidBlock(block, this.inputVariables, this.consoleLog),
      )
    ) {
      await warn(
        `Invalid blocks after mutation: ${JSON.stringify(this.blocks)}`,
        this.consoleLog,
      )
      this.blocks = [
        {
          blockName: 'set',
          var: 'out',
          value: await generateInitialValue(
            this.inputVariables,
            0,
            2,
            this.consoleLog,
          ),
        },
        {
          blockName: 'return',
          inputs: ['out'],
        },
      ]
    }
  }
}

function optimizeDeadStores(
  blocks: Block[],
  inputVariables: string[],
  consoleLog = false,
): Block[] {
  if (!blocks || blocks.length === 0) {
    return blocks
  }

  const liveVariables: Set<string> = new Set()
  const keptBlocks: Block[] = []

  const lastBlock = blocks[blocks.length - 1]
  if (lastBlock.blockName === 'return') {
    if (lastBlock.inputs && lastBlock.inputs.length > 0) {
      const returnReads = getReferencedVariables(
        lastBlock.inputs[0],
        inputVariables,
        consoleLog,
      )
      returnReads.forEach((v) => liveVariables.add(v))
    }
  } else {
    warn(
      "optimizeDeadStores: Program does not end with a 'return' block. Initial liveness based on 'out' not automatically seeded.",
      consoleLog,
    )
  }

  for (let i = blocks.length - 1; i >= 0; i--) {
    const currentBlock = blocks[i]
    let isBlockKept = true
    let blockSpecificLiveVars = new Set<string>()

    if (currentBlock.blockName === 'set') {
      const varX = typeof currentBlock.var === 'string' ? currentBlock.var : ''
      const valueV = currentBlock.value !== undefined ? currentBlock.value : 0
      blockSpecificLiveVars = getReferencedVariables(
        valueV,
        inputVariables,
        consoleLog,
      )

      if (liveVariables.has(varX)) {
        isBlockKept = true
        liveVariables.delete(varX)
      } else {
        isBlockKept = false
      }
    } else if (
      currentBlock.blockName === 'if' ||
      currentBlock.blockName === 'ifElse'
    ) {
      isBlockKept = true
      const cond =
        currentBlock.condition !== undefined ? currentBlock.condition : false
      blockSpecificLiveVars = getReferencedVariables(
        cond,
        inputVariables,
        consoleLog,
      )
    } else if (currentBlock.blockName === 'return') {
      isBlockKept = true
      if (currentBlock.inputs && currentBlock.inputs.length > 0) {
        blockSpecificLiveVars = getReferencedVariables(
          currentBlock.inputs[0],
          inputVariables,
          consoleLog,
        )
      }
    } else {
      isBlockKept = true
      blockSpecificLiveVars = getReferencedVariables(
        currentBlock,
        inputVariables,
        consoleLog,
      )
    }

    if (isBlockKept) {
      keptBlocks.push(currentBlock)
    }
    blockSpecificLiveVars.forEach((v) => liveVariables.add(v))
  }

  return keptBlocks.reverse()
}

interface ReporterBlockResult {
  block: Block
  path: number[]
}

function findReporterBlock(
  block: Block,
  path: number[] = [],
): ReporterBlockResult | null {
  if (!block || typeof block !== 'object' || !block.blockName) return null
  const blockDef = blockDefs[block.blockName || '']
  if (blockDef?.output === 'Number') return { block, path }
  if (block.inputs) {
    for (let i = 0; i < block.inputs.length; i++) {
      if (typeof block.inputs[i] === 'object') {
        const result = findReporterBlock(block.inputs[i] as Block, [...path, i])
        if (result) return result
      }
    }
  }
  return null
}

function replaceReporterBlock(
  block: Block,
  path: number[],
  replacement: Block,
): void {
  if (path.length === 0) {
    block.blockName = replacement.blockName
    block.inputs = replacement.inputs
    return
  }
  const index = path[0]
  if (block.inputs && block.inputs[index]) {
    if (path.length === 1) {
      block.inputs[index] = replacement
    } else {
      replaceReporterBlock(
        block.inputs[index] as Block,
        path.slice(1),
        replacement,
      )
    }
  }
}
