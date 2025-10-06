import blocksModule from '../files/blocks.ts'
import { log, warn, error } from '../functions/logger.ts'
import type { Block } from '../files/blocks.ts'

// Valid variables and constants
const variables = ['out', 'v0', 'v1', 'v2']
const constants = [-10, -5, -1, 0, 1, 2, 5, 10, 0.1, 0.5, 1.0, 2.0]
const booleanConstants = [true, false]
const operators = ['==', '!=', '>', '>=', '<', '<=']

// Helper function for validating variable names
function isValidProgramVariableName(
  varName: string,
  localInputVariables: string[],
): boolean {
  if (typeof varName !== 'string' || varName.trim() === '') return false // Must be non-empty string
  if (variables.includes(varName) || localInputVariables.includes(varName)) {
    return true
  }
  // Allow 'out', 'v' followed by numbers, or 'b' followed by numbers
  const dynamicVarPattern = /^(out|v[0-9]+|b[0-9]+)$/
  return dynamicVarPattern.test(varName)
}

// Helper to get all variables referenced/read by a value or block component.
function getReferencedVariables(
  valueOrBlock: any,
  inputVariables: string[],
  consoleLog = false,
): Set<string> {
  const referenced = new Set<string>()

  if (valueOrBlock === null || valueOrBlock === undefined) {
    return referenced // Null or undefined read no variables
  }

  if (typeof valueOrBlock === 'number' || typeof valueOrBlock === 'boolean') {
    return referenced // Literals read no variables
  }

  if (typeof valueOrBlock === 'string') {
    if (isValidProgramVariableName(valueOrBlock, inputVariables)) {
      referenced.add(valueOrBlock)
    }
    return referenced
  }

  if (typeof valueOrBlock === 'object') {
    const block = valueOrBlock as Block

    if (!block.blockName) {
      return referenced
    }

    switch (block.blockName) {
      case 'get_number':
        if (
          block.inputs &&
          typeof block.inputs[0] === 'string' &&
          isValidProgramVariableName(block.inputs[0] as string, inputVariables)
        ) {
          referenced.add(block.inputs[0] as string)
        }
        break
      case 'set':
        if (block.hasOwnProperty('value')) {
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
        if (block.hasOwnProperty('condition')) {
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
  }
  return referenced
}

function isValidValue(
  value: any,
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
      if ((blocksModule as any)[value.blockName]?.output === 'number')
        return true
      if (value.blockName === 'get_number') {
        const varName = value.inputs && value.inputs[0]
        if (
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
      if ((blocksModule as any)[value.blockName]?.output === 'boolean')
        return true
      if (value.blockName === 'get_boolean') {
        const varName = value.inputs && value.inputs[0]
        if (
          isValidProgramVariableName(varName, inputVariables) &&
          varName.startsWith('b')
        )
          return true
      }
    }
  }
  if (expectedType === 'variable') {
    return isValidProgramVariableName(value, inputVariables)
  }
  if (
    expectedType === "'=='|'!='|'>'|'>='|'<'|'<='" &&
    operators.includes(value)
  )
    return true
  return false
}

function isValidBlock(
  block: Block,
  inputVariables: string[] = [],
  consoleLog = false,
): boolean {
  if (!block || typeof block !== 'object' || !block.blockName) {
    warn(
      `Invalid block: missing blockName or not an object: ${JSON.stringify(
        block,
      )}`,
      consoleLog,
    )
    return false
  }

  if (block.blockName === 'set') {
    const varName = block.var
    if (!varName || !isValidProgramVariableName(varName, inputVariables)) {
      warn(
        `Invalid block: set block has invalid or missing 'var' property: '${varName}'. Must be a known variable or match pattern 'out'/'v<num>'/'b<num>'. Block: ${JSON.stringify(
          block,
        )}`,
        consoleLog,
      )
      return false
    }

    if (
      !isValidValue(
        block.value,
        varName.startsWith('b') ? 'boolean' : 'number',
        inputVariables,
        consoleLog,
      )
    ) {
      warn(
        `Invalid block: set block has invalid 'value' for var '${varName}': ${JSON.stringify(
          block,
        )}`,
        consoleLog,
      )
      return false
    }
    return true
  }

  if (block.blockName === 'return') {
    if (
      !block.inputs ||
      !Array.isArray(block.inputs) ||
      block.inputs.length !== 1
    ) {
      warn(
        `Invalid block: return block must have exactly one input in an array: ${JSON.stringify(
          block,
        )}`,
        consoleLog,
      )
      return false
    }
    if (!isValidValue(block.inputs[0], 'number', inputVariables, consoleLog)) {
      warn(
        `Invalid block: return block's input is not a valid number: ${JSON.stringify(
          block,
        )}`,
        consoleLog,
      )
      return false
    }
    return true
  }

  if (block.blockName === 'if' || block.blockName === 'ifElse') {
    if (!isValidValue(block.condition, 'boolean', inputVariables, consoleLog)) {
      warn(
        `Invalid block: ${
          block.blockName
        } has invalid condition: ${JSON.stringify(block)}`,
        consoleLog,
      )
      return false
    }
    if (
      !Array.isArray(block.actions) ||
      block.actions.some(
        (a: Block) => !isValidBlock(a, inputVariables, consoleLog),
      )
    ) {
      warn(
        `Invalid block: ${
          block.blockName
        } has invalid actions: ${JSON.stringify(block)}`,
        consoleLog,
      )
      return false
    }
    if (
      block.blockName === 'ifElse' &&
      (!Array.isArray(block.elseActions) ||
        block.elseActions.some(
          (a: Block) => !isValidBlock(a, inputVariables, consoleLog),
        ))
    ) {
      warn(
        `Invalid block: ifElse has invalid elseActions: ${JSON.stringify(
          block,
        )}`,
        consoleLog,
      )
      return false
    }
    return true
  }

  const blockDef = (blocksModule as any)[block.blockName]
  if (!blockDef) {
    warn(
      `Invalid block: unknown blockName '${
        block.blockName
      }' (and not a special block): ${JSON.stringify(block)}`,
      consoleLog,
    )
    return false
  }

  if (blockDef.inputs) {
    if (
      !Array.isArray(block.inputs) ||
      block.inputs.length !== blockDef.inputs.length
    ) {
      warn(
        `Invalid block: incorrect inputs array for ${
          block.blockName
        }, expected ${blockDef.inputs.length}, got ${
          block.inputs?.length || 0
        }: ${JSON.stringify(block)}`,
        consoleLog,
      )
      return false
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
        warn(
          `Invalid block: input ${i} ('${blockDef.inputs[i]}') for ${
            block.blockName
          } is invalid: ${JSON.stringify(block)}`,
          consoleLog,
        )
        return false
      }
    }
  } else if (block.inputs && block.inputs.length > 0) {
    warn(
      `Invalid block: ${
        block.blockName
      } does not define inputs in blocksModule, but block instance has inputs: ${JSON.stringify(
        block,
      )}`,
      consoleLog,
    )
    return false
  }

  return true
}

async function generateInput(
  type: string,
  depth: number,
  maxDepth: number,
  inputVariables: string[],
  consoleLog: boolean,
): Promise<any> {
  let returnValue

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
            `generateInput (for number): generateRandomBlock returned invalid block: ${JSON.stringify(
              generatedBlock,
            )}. Defaulting to constant.`,
            consoleLog,
          )
          returnValue = constants[Math.floor(Math.random() * constants.length)]
        } else {
          returnValue = generatedBlock
        }
      } else {
        warn(
          `generateInput (for number): generateRandomBlock returned non-object: ${JSON.stringify(
            generatedBlock,
          )}. Defaulting to constant.`,
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
          (blocksModule as any)[boolBlock.blockName]?.output !== 'boolean'
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
      `generateInput: Unknown type '${type}' (not max depth). Defaulting to null, then will be further checked.`,
      consoleLog,
    )
    returnValue = null
  }

  if (returnValue === null) {
    warn(
      `generateInput for type '${type}' resulted in null. Defaulting to 0 or false.`,
      consoleLog,
    )
    return type === 'boolean' ? false : 0
  }
  if (typeof returnValue === 'object') {
    if (
      !returnValue.blockName ||
      !isValidBlock(returnValue, inputVariables, true)
    ) {
      warn(
        `generateInput for type '${type}': Returning object is invalid: ${JSON.stringify(
          returnValue,
        )}. Defaulting based on type.`,
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

async function generateInitialValue(
  inputVariables: string[],
  depth: number,
  maxDepth: number,
  consoleLog: boolean,
): Promise<any> {
  if (Math.random() < 0.7 && inputVariables.length >= 3) {
    const v0 = inputVariables[0]
    const v1 = inputVariables[1]
    const v2 = inputVariables[2]
    const innerAdd: Block = {
      blockName: 'add',
      inputs: [v0, v1],
    }
    const outerAdd: Block = {
      blockName: 'add',
      inputs: [innerAdd, v2],
    }
    await log(
      `Depth ${depth}: Generated nested add block ${JSON.stringify(outerAdd)}`,
      consoleLog,
    )
    return outerAdd
  }
  return await generateInput(
    'number',
    depth,
    maxDepth,
    inputVariables,
    consoleLog,
  )
}

export class ProgenyProgram {
  blocks: Block[]
  inputVariables: string[]
  consoleLog: boolean

  constructor(
    initialBlocks: Block[],
    inputVariables: string[] = [],
    consoleLog = false,
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
            `Invalid block provided to constructor, filtering out: ${JSON.stringify(
              block,
            )}`,
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

    this.blocks = processedBlocks

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
        `CRITICAL: Blocks in constructor are still invalid after processing and defaults: ${JSON.stringify(
          this.blocks,
        )}. This should not happen.`,
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
    let blocksToConstruct

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
    input: any,
    inputs: any,
    state: any,
    expectedType: string,
  ): Promise<any> {
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
      const blockDef = (blocksModule as any)[input.blockName]
      if (blockDef.output === 'number' && expectedType === 'number') {
        return await this.executeBlock(input, inputs, state)
      }
      if (blockDef.output === 'boolean' && expectedType === 'boolean') {
        return await this.executeBlock(input, inputs, state)
      }
      if (input.blockName === 'get_number' && expectedType === 'number') {
        const key = input.inputs && (input.inputs[0] as string)
        if (
          !key ||
          !(variables.includes(key) || this.inputVariables.includes(key))
        ) {
          await warn(
            `Invalid variable for get: ${
              key || 'undefined'
            } in block ${JSON.stringify(input)}`,
            this.consoleLog,
          )
          return 0
        }
        const value = state.vars[key]
        if (typeof value === 'number') {
          return value
        }
        await warn(
          `Type mismatch for get(${key}): expected number, got ${typeof value}`,
          this.consoleLog,
        )
        return 0
      }
      if (input.blockName === 'get_boolean' && expectedType === 'boolean') {
        const key = input.inputs && (input.inputs[0] as string)
        if (
          !key ||
          !(variables.includes(key) || this.inputVariables.includes(key))
        ) {
          await warn(
            `Invalid variable for get: ${
              key || 'undefined'
            } in block ${JSON.stringify(input)}`,
            this.consoleLog,
          )
          return false
        }
        const value = state.vars[key]
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
      `Invalid input for ${expectedType}: ${JSON.stringify(
        input,
      )} (type: ${typeof input})`,
      this.consoleLog,
    )
    return expectedType === 'boolean' ? false : 0
  }

  async executeBlock(
    block: Block,
    runTimeInputs: any,
    state: any,
  ): Promise<any> {
    if (!isValidBlock(block, this.inputVariables, this.consoleLog)) {
      await warn(
        `Executing invalid block: ${JSON.stringify(block)}`,
        this.consoleLog,
      )
      return null
    }

    const blockName = block.blockName as string

    if (blockName === 'set') {
      const varType = block.var?.startsWith('b') ? 'boolean' : 'number'
      state.vars[block.var as string] = await this.resolveInput(
        block.value,
        runTimeInputs,
        state,
        varType,
      )
      return
    }

    if (blockName === 'return') {
      const valueToReturn = await this.resolveInput(
        (block.inputs as any[])[0],
        runTimeInputs,
        state,
        'number',
      )
      state.output = valueToReturn
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

    const blockDef = (blocksModule as any)[blockName]

    if (!blockDef.output) {
      await error(
        `Block '${blockName}' from blocksModule has no 'output' and is not a handled special block. Executing its action if available.`,
        this.consoleLog,
      )
      if (blockDef.action && typeof blockDef.action === 'function') {
        const resolvedInputsForStackAction = block.inputs
          ? await Promise.all(
              (block.inputs as any[]).map((input, i) =>
                this.resolveInput(
                  input,
                  runTimeInputs,
                  state,
                  blockDef.inputs[i],
                ),
              ),
            )
          : []
        blockDef.action(...resolvedInputsForStackAction, state)
      }
      return
    }

    let resolvedInputs: any[] = []
    if (blockDef.inputs) {
      if (Array.isArray(block.inputs)) {
        resolvedInputs = await Promise.all(
          (block.inputs as any[]).map((input, i) =>
            this.resolveInput(input, runTimeInputs, state, blockDef.inputs[i]),
          ),
        )
      } else if (block.inputs && block.inputs.length > 0) {
        await error(
          `Block '${blockName}' input structure mismatch. Def inputs: ${JSON.stringify(
            blockDef.inputs,
          )}, Instance inputs: ${JSON.stringify(
            block.inputs,
          )}. Block: ${JSON.stringify(block)}`,
          this.consoleLog,
        )
        return blockDef.output === 'boolean' ? false : 0
      }
    } else if (block.inputs && block.inputs.length > 0) {
      await error(
        `Block '${blockName}' instance has inputs, but definition does not. Inputs ignored. Block: ${JSON.stringify(
          block,
        )}`,
        this.consoleLog,
      )
    }

    if (typeof blockDef.action === 'function') {
      return blockDef.action(...resolvedInputs, state)
    } else {
      if (
        resolvedInputs.length > 0 &&
        blockDef.inputs &&
        blockDef.inputs.length > 0
      ) {
        await warn(
          `Constant block '${blockName}' (action is not a function) had inputs defined and resolved. This is unusual. Inputs ignored.`,
          this.consoleLog,
        )
      }
      return blockDef.action
    }
  }

  async run(runTimeInputs: { [key: string]: number }): Promise<number> {
    const initialVars: { [key: string]: number | boolean } = {
      out: 0,
      v0: 0,
      v1: 0,
      v2: 0,
    }

    for (const varName of this.inputVariables) {
      if (runTimeInputs.hasOwnProperty(varName)) {
        initialVars[varName] = runTimeInputs[varName]
      } else {
        initialVars[varName] = 0
        warn(
          `Input variable '${varName}' not provided in runTimeInputs, defaulting to 0.`,
          this.consoleLog,
        )
      }
    }

    const state = {
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
      ? Object.keys(blocksModule).filter(
          (t) =>
            !(blocksModule as any)[t].output && t !== 'return' && t !== 'set',
        )
      : Object.keys(blocksModule).filter(
          (t) =>
            (blocksModule as any)[t].output === 'number' &&
            t !== 'get_number' &&
            t !== 'return',
        )

    const blockName = blockTypes[Math.floor(Math.random() * blockTypes.length)]
    const blockDef = (blocksModule as any)[blockName]
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
          `Invalid value for set block (expected ${expectedValueType}): ${JSON.stringify(
            block.value,
          )}`,
          consoleLog,
        )
        if (expectedValueType === 'boolean') {
          block.value =
            booleanConstants[
              Math.floor(Math.random() * booleanConstants.length)
            ]
        } else {
          block.value =
            inputVariables.length > 0 && typeof inputVariables[0] === 'number'
              ? inputVariables[0]
              : constants[0]
        }
      }
    } else if (blockDef.inputs) {
      block.inputs = await Promise.all(
        blockDef.inputs.map(async (inputType: string) => {
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
      `Depth ${depth}: Generated block ${blockName} ${
        block.inputs ? 'with inputs ' + JSON.stringify(block.inputs) : ''
      }${block.var ? ' var ' + block.var : ''}${
        block.value ? ' value ' + JSON.stringify(block.value) : ''
      }`,
      consoleLog,
    )
    return block
  }

  async mutate() {
    const newBlocks = [...this.blocks]
    if (Math.random() < 0.7) {
      const setIndex = newBlocks.findIndex(
        (b) => b.blockName === 'set' && b.var === 'out',
      )
      if (setIndex >= 0) {
        const newValue = await generateInitialValue(
          this.inputVariables,
          0,
          2,
          this.consoleLog,
        )
        if (
          isValidValue(newValue, 'number', this.inputVariables, this.consoleLog)
        ) {
          newBlocks[setIndex].value = newValue
        } else {
          await warn(
            `Invalid new value for set out: ${JSON.stringify(newValue)}`,
            this.consoleLog,
          )
          newBlocks[setIndex].value =
            this.inputVariables.length > 0
              ? this.inputVariables[
                  Math.floor(Math.random() * this.inputVariables.length)
                ]
              : constants[0]
        }
      }
    } else {
      const setIndex = newBlocks.findIndex(
        (b) => b.blockName === 'set' && b.var === 'out',
      )
      if (
        setIndex >= 0 &&
        typeof newBlocks[setIndex].value === 'object' &&
        isValidBlock(
          newBlocks[setIndex].value as Block,
          this.inputVariables,
          this.consoleLog,
        )
      ) {
        const reporterBlock = findReporterBlock(
          newBlocks[setIndex].value as Block,
        )
        if (reporterBlock) {
          const usedVars = newBlocks.filter((b) => b.var).map((b) => b.var)
          const newVar =
            variables.filter((v) => v !== 'out' && !usedVars.includes(v))[0] ||
            `v${usedVars.length}`
          const newSetBlock: Block = {
            blockName: 'set',
            var: newVar,
            value: reporterBlock.block,
          }
          if (isValidBlock(newSetBlock, this.inputVariables, this.consoleLog)) {
            replaceReporterBlock(
              newBlocks[setIndex].value as Block,
              reporterBlock.path,
              { blockName: 'get_number', inputs: [newVar] },
            )
            newBlocks.splice(setIndex, 0, newSetBlock)
          } else {
            await warn(
              `Invalid new set block in mutation: ${JSON.stringify(
                newSetBlock,
              )}`,
              this.consoleLog,
            )
          }
        }
      }
    }
    this.blocks = newBlocks.filter((block) =>
      isValidBlock(block, this.inputVariables, this.consoleLog),
    )
    if (
      this.blocks.length === 0 ||
      !this.blocks.some((b) => b.blockName === 'return')
    ) {
      await warn(
        `Reset to default blocks after mutation: ${JSON.stringify(
          this.blocks,
        )}`,
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
    this.blocks = optimizeDeadStores(
      this.blocks,
      this.inputVariables,
      this.consoleLog,
    )
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

  const liveVariables = new Set<string>()
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
      const varX = currentBlock.var
      const valueV = currentBlock.value
      blockSpecificLiveVars = getReferencedVariables(
        valueV,
        inputVariables,
        consoleLog,
      )

      if (varX && liveVariables.has(varX)) {
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
      blockSpecificLiveVars = getReferencedVariables(
        currentBlock.condition,
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

function findReporterBlock(
  block: Block,
  path: number[] = [],
): { block: Block; path: number[] } | null {
  if (!block || typeof block !== 'object' || !block.blockName) return null
  const blockDef = (blocksModule as any)[block.blockName]
  if (blockDef?.output === 'number') return { block, path }
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
) {
  if (path.length === 0) {
    block.blockName = replacement.blockName
    block.inputs = replacement.inputs
    return
  }
  const index = path[0]
  if (block.inputs && (block.inputs as any[])[index]) {
    if (path.length === 1) {
      ;(block.inputs as any[])[index] = replacement
    } else {
      replaceReporterBlock(
        (block.inputs as any[])[index] as Block,
        path.slice(1),
        replacement,
      )
    }
  }
}
