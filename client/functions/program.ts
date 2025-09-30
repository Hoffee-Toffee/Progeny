// Recursively repair a block tree to ensure all blocks have valid inputs arrays
export function repairBlockTree(block: any, blocksDef: Record<string, BlockDef>): any {
  if (!block || typeof block !== 'object' || !('blockName' in block)) return block;
  const def = blocksDef[block.blockName];
  if (!def) return block;
  const expectedInputs = def.inputs || [];
  let inputs = Array.isArray(block.inputs) ? block.inputs.slice() : [];
  // Ensure correct number of inputs
  while (inputs.length < expectedInputs.length) {
    // Fill missing inputs with a valid value
    const inputType = expectedInputs[inputs.length];
    if (inputType === 'number') inputs.push(0);
    else if (inputType === 'boolean') inputs.push(false);
    else if (inputType === 'variable') inputs.push('x');
    else if (Array.isArray(inputType)) inputs.push(inputType[0]);
    else inputs.push(0);
  }
  // Recursively repair each input
  inputs = inputs.map((input, i) => repairBlockTree(input, blocksDef));
  return { ...block, inputs };
}
// Type-driven program core for Progeny (TypeScript)
import blocksImport from '../files/blocks'
import type { Block } from '../files/blocks'

// Use the Block type from blocks.ts for program logic

// Minimal BlockDef type for type safety
type BlockDef = {
  inputs?: unknown[]
  action?: (...args: unknown[]) => unknown
  output?: string
  [key: string]: unknown
}

// Add index signature for blocks
const blocks: Record<string, BlockDef> = blocksImport as Record<
  string,
  BlockDef
>

export { blocks }

function getBlockNamesByOutputType(type: string): string[] {
  return Object.keys(blocks).filter((name) => blocks[name]?.output === type)
}

function getActionBlockNames(): string[] {
  return Object.keys(blocks).filter((name) => !blocks[name]?.output)
}

export function generateInput(
  type: unknown,
  inputVariables: string[],
  depth = 0,
  maxDepth = 4, // Increased default maxDepth for deeper trees
): unknown {
  // With some probability, allow deeper trees even if depth >= maxDepth
  const allowDeeper = depth < maxDepth || (depth < maxDepth + 2 && Math.random() < 0.3);
  if (!allowDeeper) {
    if (type === 'number') {
      if (inputVariables.length > 0 && Math.random() < 0.5) {
        return inputVariables[Math.floor(Math.random() * inputVariables.length)]
      }
      return [0, 1, 2, 5, 10][Math.floor(Math.random() * 5)]
    }
    if (type === 'boolean') {
      return Math.random() < 0.5
    }
    if (type === 'variable') {
      return inputVariables[Math.floor(Math.random() * inputVariables.length)]
    }
    if (Array.isArray(type)) {
      return type[Math.floor(Math.random() * type.length)]
    }
    return 0
  }
  const candidates = getBlockNamesByOutputType(type as string)
  if (candidates.length === 0) {
    return generateInput(type, inputVariables, maxDepth, maxDepth)
  }
  const blockName = candidates[Math.floor(Math.random() * candidates.length)]
  const blockDef = blocks[blockName]
  // Always generate the correct number of inputs, filling with fallback values if needed
  const inputs = (blockDef.inputs || []).map((inputType: unknown) => {
    const val = generateInput(inputType, inputVariables, depth + 1, maxDepth);
    // Defensive: if inputType is 'number' but val is undefined, use 0
    if (val === undefined) {
      if (inputType === 'number') return 0;
      if (inputType === 'boolean') return false;
      if (inputType === 'variable') return inputVariables[0] || 'x';
      if (Array.isArray(inputType)) return inputType[0];
      return 0;
    }
    return val;
  });
  return { blockName, inputs };
}

function generateAction(
  inputVariables: string[],
  depth = 0,
  maxDepth = 2,
): unknown {
  const candidates = getActionBlockNames()
  const blockName = candidates[Math.floor(Math.random() * candidates.length)]
  const blockDef = blocks[blockName]
  const inputs = (blockDef.inputs || []).map((inputType: unknown) => {
    if (Array.isArray(inputType) || typeof inputType === 'string') {
      return generateInput(inputType, inputVariables, depth + 1, maxDepth)
    }
    if (inputType === 'action[]') {
      const n = 1 + Math.floor(Math.random() * 2)
      return Array.from({ length: n }, () =>
        generateAction(inputVariables, depth + 1, maxDepth),
      )
    }
    return null
  })
  return { blockName, inputs }
}

function isValidBlock(block: unknown, inputVariables: string[] = []): boolean {
  if (!block || typeof block !== 'object' || !('blockName' in block))
    return false
  const b = block as { blockName: string; inputs?: unknown[] }
  const blockDef = blocks[b.blockName]
  if (!blockDef) return false
  if (blockDef.inputs) {
    if (!Array.isArray(b.inputs) || b.inputs.length !== blockDef.inputs.length)
      return false
    for (let i = 0; i < blockDef.inputs.length; i++) {
      const inputType = blockDef.inputs[i]
      const input = b.inputs[i]
      if (Array.isArray(inputType) || typeof inputType === 'string') {
        if (!isValidValue(input, inputType, inputVariables)) return false
      } else if (inputType === 'action[]') {
        if (
          !Array.isArray(input) ||
          input.some((b) => !isValidBlock(b, inputVariables))
        )
          return false
      }
    }
  }
  return true
}

function isValidValue(
  value: unknown,
  type: unknown,
  inputVariables: string[],
): boolean {
  if (type === 'number')
    return (
      typeof value === 'number' ||
      (typeof value === 'string' && inputVariables.includes(value)) ||
      (typeof value === 'object' && isValidBlock(value, inputVariables))
    )
  if (type === 'boolean')
    return (
      typeof value === 'boolean' ||
      (typeof value === 'object' && isValidBlock(value, inputVariables))
    )
  if (type === 'variable')
    return typeof value === 'string' && inputVariables.includes(value)
  if (Array.isArray(type)) return type.includes(value)
  return false
}

export async function executeBlock(
  block: unknown,
  state: Record<string, unknown>,
): Promise<unknown> {
  // Defensive: ensure state and state.vars are always initialized
  if (!state) throw new Error('State must be provided to executeBlock')
  if (!state.vars || typeof state.vars !== 'object') state.vars = {}
  const vars = state.vars as Record<string, unknown>
  if (typeof block !== 'object' || block === null || !('blockName' in block)) {
    // If it's a string, treat as variable name and look up value
    if (typeof block === 'string') {
      if (block in vars) {
        // console.log(
        //   '[executeBlock] Variable reference (bare):',
        //   block,
        //   '=',
        //   vars[block],
        // )
        return vars[block]
      } else {
        // console.warn(
        //   '[executeBlock] Variable reference (bare):',
        //   block,
        //   'not found in state.vars, using 0',
        // )
        return 0
      }
    }
    // If it's a number, use as-is
    if (typeof block === 'number') {
      // console.log('[executeBlock] Literal number (bare):', block)
      return block
    }
    // Otherwise, treat as 0
    // console.warn(
    //   '[executeBlock] Non-object or missing blockName:',
    //   block,
    //   'using 0',
    // )
    return 0
  }
  // block is checked to be an object with blockName below
  const blockObj = block as { blockName: string; inputs: unknown[] }
  const blockDef = blocks[blockObj.blockName]
  if (!blockDef) {
    console.error(
      '[executeBlock] Unknown block:',
      block.blockName,
      'Block object:',
      block,
    )
    throw new Error('Unknown block: ' + block.blockName)
  }
  let resolvedInputs: unknown[] = []
  if (blockDef.inputs && blockDef.inputs.length > 0) {
    for (let i = 0; i < blockDef.inputs.length; i++) {
      const inputType = blockDef.inputs[i]
      const input = blockObj.inputs[i]
      if (inputType === 'action[]') {
        resolvedInputs.push(async () => {
          for (const action of input as unknown[])
            await executeBlock(action, state)
        })
      } else if (Array.isArray(inputType) || typeof inputType === 'string') {
        // Recursively resolve input
        if (
          typeof input === 'object' &&
          input !== null &&
          (input as any).blockName
        ) {
          const val = await executeBlock(input, state)
          // console.log(
          //   `[executeBlock] Resolved input block for ${blockObj.blockName} input[${i}]:`,
          //   val,
          // )
          resolvedInputs.push(val)
        } else if (typeof input === 'string') {
          // Always treat as variable name
          if (input in vars) {
            // console.log(
            //   `[executeBlock] Variable reference for ${blockObj.blockName} input[${i}]: '${input}' =`,
            //   vars[input],
            // )
            resolvedInputs.push(vars[input])
          } else {
            // console.warn(
            //   `[executeBlock] Variable reference for ${blockObj.blockName} input[${i}]: '${input}' not found in state.vars, using 0`,
            // )
            resolvedInputs.push(0)
          }
        } else if (typeof input === 'number') {
          // console.log(
          //   `[executeBlock] Literal number for ${blockObj.blockName} input[${i}]:`,
          //   input,
          // )
          resolvedInputs.push(input)
        } else {
          // console.warn(
          //   `[executeBlock] Unrecognized input for ${blockObj.blockName} input[${i}]:`,
          //   input,
          //   'using 0',
          // )
          resolvedInputs.push(0)
        }
      }
    }
  } else {
    // Fallback: recursively resolve each input
    resolvedInputs = blockObj.inputs
      ? await Promise.all(
          blockObj.inputs.map(async (input) => {
            if (
              typeof input === 'object' &&
              input !== null &&
              (input as any).blockName
            ) {
              return await executeBlock(input, state)
            } else if (typeof input === 'string') {
              if (input in vars) {
                return vars[input]
              } else {
                return 0
              }
            } else if (typeof input === 'number') {
              return input
            } else {
              return 0
            }
          }),
        )
      : []
  }
  if (typeof blockDef.action === 'function') {
    if (
      blockObj.blockName === 'set_number' &&
      typeof blockObj.inputs[0] === 'string'
    ) {
      // console.log('[executeBlock] set_number DIAG:', {
      //   blockObj,
      //   resolvedInputs,
      //   valueToSet: resolvedInputs[1],
      //   originalInput: blockObj.inputs[1],
      // })
      // console.log(
      //   `[executeBlock] set_number: setting '${blockObj.inputs[0]}' to`,
      //   resolvedInputs[1],
      // )
      return blockDef.action(blockObj.inputs[0], resolvedInputs[1], state)
    }
    if (
      blockObj.blockName === 'get_number' &&
      typeof blockObj.inputs[0] === 'string'
    ) {
      // console.log(
      //   `[executeBlock] get_number: getting '${blockObj.inputs[0]}' from state.vars`,
      // )
      return blockDef.action(blockObj.inputs[0], state)
    }
    // console.log(
    //   `[executeBlock] Executing action for ${blockObj.blockName} with inputs:`,
    //   resolvedInputs,
    //   'State:',
    //   state.vars,
    // )
    return blockDef.action(...resolvedInputs, state)
  }
  // console.log(
  //   `[executeBlock] No action for block ${blockObj.blockName}, returning undefined.`,
  // )
  return undefined
}

// ProgenyProgram class: encapsulates a program (blocks + inputVariables + run logic)
export class ProgenyProgram {
  blocks: Block[]
  inputVariables: string[]
  consoleLog: boolean

  constructor(blocks: Block[], inputVariables: string[], consoleLog = false) {
    this.blocks = blocks
    this.inputVariables = inputVariables
    this.consoleLog = consoleLog
  }

  // Run the program with given inputs, return the value of 'out' after execution
  async run(inputs: Record<string, unknown>): Promise<unknown> {
    const state = { vars: { ...inputs, out: 0 } }
    let result: unknown = 0
    for (const block of this.blocks) {
      result = await executeBlock(block, state)
    }
    // Always return the value of 'out' variable
    return state.vars['out']
  }

  // Static async create: generate a random valid program
  static async create(
    _blocks: Block[] = [],
    testInputs: { name: string; type: string }[],
    consoleLog = false,
  ): Promise<ProgenyProgram> {
    const inputVariables = testInputs.map((i) => i.name)
    // Generate a random expression for 'out'
    const expr = generateInput('number', inputVariables, 0, 2) as
      | string
      | number
      | boolean
      | Block
    // Always set 'out' and get 'out' (for compatibility)
    const blocks: Block[] = [
      { blockName: 'set_number', inputs: ['out', expr] },
      { blockName: 'get_number', inputs: ['out'] },
    ]
    return new ProgenyProgram(blocks, inputVariables, consoleLog)
  }
}
