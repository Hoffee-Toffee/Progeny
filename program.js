import blocksModule from './blocks.js';
import { log, warn, error } from './logger.js';

// Valid variables and constants
const variables = ['out', 'v0', 'v1', 'v2'];
const constants = [-10, -5, -1, 0, 1, 2, 5, 10, 0.1, 0.5, 1.0, 2.0];
const booleanConstants = [true, false];
const operators = ['==', '!=', '>', '>=', '<', '<='];

// Helper function for validating variable names
function isValidProgramVariableName(varName, localInputVariables) {
  if (typeof varName !== 'string' || varName.trim() === '') return false; // Must be non-empty string
  if (variables.includes(varName) || localInputVariables.includes(varName)) {
    return true;
  }
  // Allow 'out', 'v' followed by numbers, or 'b' followed by numbers
  const dynamicVarPattern = /^(out|v[0-9]+|b[0-9]+)$/;
  return dynamicVarPattern.test(varName);
}

function isValidValue(value, expectedType, inputVariables = [], consoleLog = false) {
  if (value === null || value === undefined) return false;
  if (expectedType === 'number') {
    if (typeof value === 'number') return true;
    if (typeof value === 'string' && (variables.includes(value) || inputVariables.includes(value))) return true;
    if (typeof value === 'object' && value.blockName && isValidBlock(value, inputVariables, consoleLog)) { // Ensure blockName exists and pass context
      if (blocksModule[value.blockName]?.output === 'number') return true;
      if (value.blockName === 'get') {
        const varName = value.inputs && value.inputs[0];
        if (isValidProgramVariableName(varName, inputVariables) && !varName.startsWith('b')) return true;
      }
    }
  }
  if (expectedType === 'boolean') {
    if (typeof value === 'boolean') return true;
    // For string variable names, check if they are valid program variable names.
    // The type (boolean) will be enforced by how it's set or its naming convention (e.g. varName.startsWith('b')).
    if (typeof value === 'string' && isValidProgramVariableName(value, inputVariables)) return true;
    if (typeof value === 'object' && value.blockName && isValidBlock(value, inputVariables, consoleLog)) { // Ensure blockName exists and pass context
      if (blocksModule[value.blockName]?.output === 'boolean') return true;
      if (value.blockName === 'get') {
        const varName = value.inputs && value.inputs[0];
        if (isValidProgramVariableName(varName, inputVariables) && varName.startsWith('b')) return true;
      }
    }
  }
  if (expectedType === 'variable') { // This is for validating inputs to 'get' or 'set's var field
    return isValidProgramVariableName(value, inputVariables);
  }
  if (expectedType === "'=='|'!='|'>'|'>='|'<'|'<='" && operators.includes(value)) return true;
  return false;
}

function isValidBlock(block, inputVariables = [], consoleLog = false) {
  if (!block || typeof block !== 'object' || !block.blockName) {
    warn(`Invalid block: missing blockName or not an object: ${JSON.stringify(block)}`, consoleLog);
    return false;
  }

  // Handle special blocks first based on their unique structure
  if (block.blockName === 'set') {
    const varName = block.var;
    if (!isValidProgramVariableName(varName, inputVariables)) {
      warn(`Invalid block: set block has invalid or missing 'var' property: '${varName}'. Must be a known variable or match pattern 'out'/'v<num>'/'b<num>'. Block: ${JSON.stringify(block)}`, consoleLog);
      return false;
    }

    if (!isValidValue(block.value, varName.startsWith('b') ? 'boolean' : 'number', inputVariables, consoleLog)) {
      warn(`Invalid block: set block has invalid 'value' for var '${varName}': ${JSON.stringify(block)}`, consoleLog);
      return false;
    }
    return true; // Valid 'set' block
  }

  if (block.blockName === 'return') {
    // 'return' is special and not in blocksModule, expects one numeric input in block.inputs[0]
    if (!block.inputs || !Array.isArray(block.inputs) || block.inputs.length !== 1) {
      warn(`Invalid block: return block must have exactly one input in an array: ${JSON.stringify(block)}`, consoleLog);
      return false;
    }
    if (!isValidValue(block.inputs[0], 'number', inputVariables, consoleLog)) {
      warn(`Invalid block: return block's input is not a valid number: ${JSON.stringify(block)}`, consoleLog);
      return false;
    }
    return true; // Valid 'return' block
  }

  if (block.blockName === 'if' || block.blockName === 'ifElse') {
    // 'if'/'ifElse' have 'condition', 'actions', and optionally 'elseActions'
    if (!isValidValue(block.condition, 'boolean', inputVariables, consoleLog)) {
      warn(`Invalid block: ${block.blockName} has invalid condition: ${JSON.stringify(block)}`, consoleLog);
      return false;
    }
    if (!Array.isArray(block.actions) || block.actions.some(a => !isValidBlock(a, inputVariables, consoleLog))) {
      warn(`Invalid block: ${block.blockName} has invalid actions: ${JSON.stringify(block)}`, consoleLog);
      return false;
    }
    if (block.blockName === 'ifElse' && (!Array.isArray(block.elseActions) || block.elseActions.some(a => !isValidBlock(a, inputVariables, consoleLog)))) {
      warn(`Invalid block: ifElse has invalid elseActions: ${JSON.stringify(block)}`, consoleLog);
      return false;
    }
    return true; // Valid 'if'/'ifElse' block
  }

  // For all other blocks, assume they are defined in blocksModule
  const blockDef = blocksModule[block.blockName];
  if (!blockDef) {
    warn(`Invalid block: unknown blockName '${block.blockName}' (and not a special block): ${JSON.stringify(block)}`, consoleLog);
    return false;
  }

  // Generic validation for blocks defined in blocksModule, using their 'inputs' definition
  if (blockDef.inputs) {
    if (!Array.isArray(block.inputs) || block.inputs.length !== blockDef.inputs.length) {
      warn(`Invalid block: incorrect inputs array for ${block.blockName}, expected ${blockDef.inputs.length}, got ${block.inputs?.length || 0}: ${JSON.stringify(block)}`, consoleLog);
      return false;
    }
    for (let i = 0; i < blockDef.inputs.length; i++) {
      if (!isValidValue(block.inputs[i], blockDef.inputs[i], inputVariables, consoleLog)) {
        warn(`Invalid block: input ${i} ('${blockDef.inputs[i]}') for ${block.blockName} is invalid: ${JSON.stringify(block)}`, consoleLog);
        return false;
      }
    }
  } else if (block.inputs && block.inputs.length > 0) {
    // Block definition has no inputs, but instance has inputs (e.g. 'pi' should not have inputs)
    warn(`Invalid block: ${block.blockName} does not define inputs in blocksModule, but block instance has inputs: ${JSON.stringify(block)}`, consoleLog);
    return false;
  }
  
  return true; // Passed all checks
}

async function generateInput(type, depth, maxDepth, inputVariables, consoleLog) {
  let returnValue;

  if (depth >= maxDepth) {
    if (type === 'number') {
      await log(`Depth ${depth}: Hit recursion limit for number type '${type}'`, consoleLog);
      returnValue = inputVariables.length > 0 ? inputVariables[Math.floor(Math.random() * inputVariables.length)] : constants[Math.floor(Math.random() * constants.length)];
    } else if (type === 'boolean') {
      returnValue = booleanConstants[Math.floor(Math.random() * booleanConstants.length)];
    } else if (type === 'variable') {
      returnValue = variables[Math.floor(Math.random() * variables.length)];
    } else if (type === "'=='|'!='|'>'|'>='|'<'|'<='") { 
      returnValue = operators[Math.floor(Math.random() * operators.length)];
    } else {
      warn(`generateInput: Unknown type '${type}' at max depth ${depth}. Defaulting to 0.`, consoleLog);
      returnValue = 0; 
    }
  }
  // Specific logic for type (if not at max depth)
  else if (type === 'number') {
    if (Math.random() < 0.6 && inputVariables.length > 0) {
      const stringValue = inputVariables[Math.floor(Math.random() * inputVariables.length)];
      await log(`Depth ${depth}: Generated number (from input var) ${stringValue}`, consoleLog);
      returnValue = stringValue;
    } else if (Math.random() < 0.3) { 
      const generatedBlock = await ProgenyProgram.generateRandomBlock(depth + 1, maxDepth, false, null, inputVariables, consoleLog); // depth + 1 for sub-blocks
      if (typeof generatedBlock === 'object' && generatedBlock !== null) {
        // Force consoleLog for this critical internal check
        if (!generatedBlock.blockName || !isValidBlock(generatedBlock, inputVariables, true)) { 
          warn(`generateInput (for number): generateRandomBlock returned invalid block: ${JSON.stringify(generatedBlock)}. Defaulting to constant.`, consoleLog);
          returnValue = constants[Math.floor(Math.random() * constants.length)]; 
        } else {
          returnValue = generatedBlock; 
        }
      } else { 
        warn(`generateInput (for number): generateRandomBlock returned non-object: ${JSON.stringify(generatedBlock)}. Defaulting to constant.`, consoleLog);
        returnValue = constants[Math.floor(Math.random() * constants.length)];
      }
    } else {
      returnValue = constants[Math.floor(Math.random() * constants.length)];
    }
  } else if (type === 'boolean') {
    // Example: allow generating a boolean-producing block, assuming generateRandomBlock could be extended
    // For now, this path will mostly generate boolean constants as generateRandomBlock is not type-targeted for output.
    if (Math.random() < 0.1) { // Lower chance for boolean blocks for now
        const boolBlock = await ProgenyProgram.generateRandomBlock(depth + 1, maxDepth, false, null, inputVariables, consoleLog); // No specific output type target yet
        if (typeof boolBlock === 'object' && boolBlock !== null) {
            if (!boolBlock.blockName || !isValidBlock(boolBlock, inputVariables, true) || blocksModule[boolBlock.blockName]?.output !== 'boolean') {
                // warn(`generateInput (for boolean): generateRandomBlock returned invalid/non-boolean block: ${JSON.stringify(boolBlock)}. Defaulting to boolean constant.`, consoleLog);
                returnValue = booleanConstants[Math.floor(Math.random() * booleanConstants.length)];
            } else {
                returnValue = boolBlock;
            }
        } else {
            // warn(`generateInput (for boolean): generateRandomBlock returned non-object: ${JSON.stringify(boolBlock)}. Defaulting to boolean constant.`, consoleLog);
            returnValue = booleanConstants[Math.floor(Math.random() * booleanConstants.length)];
        }
    } else {
        returnValue = booleanConstants[Math.floor(Math.random() * booleanConstants.length)];
    }
  } else if (type === 'variable') {
    returnValue = variables[Math.floor(Math.random() * variables.length)];
  } else if (type === "'=='|'!='|'>'|'>='|'<'|'<='") { 
    returnValue = operators[Math.floor(Math.random() * operators.length)];
  } else {
    warn(`generateInput: Unknown type '${type}' (not max depth). Defaulting to null, then will be further checked.`, consoleLog);
    returnValue = null; 
  }

  // Final safety net for returnValue before exiting generateInput
  if (returnValue === null) {
    warn(`generateInput for type '${type}' resulted in null. Defaulting to 0 or false.`, consoleLog);
    return type === 'boolean' ? false : 0;
  }
  if (typeof returnValue === 'object') {
    // Does not apply to string variable names, only to actual block objects
    if (!returnValue.blockName || !isValidBlock(returnValue, inputVariables, true)) { 
      warn(`generateInput for type '${type}': Returning object is invalid: ${JSON.stringify(returnValue)}. Defaulting based on type.`, consoleLog);
      if (type === 'number') return constants[Math.floor(Math.random() * constants.length)];
      if (type === 'boolean') return booleanConstants[Math.floor(Math.random() * booleanConstants.length)];
      return 0; // General fallback for object that should have been a block
    }
  }
  
  return returnValue;
}

async function generateInitialValue(inputVariables, depth, maxDepth, consoleLog) {
  if (Math.random() < 0.7 && inputVariables.length >= 2) {
    // Bias toward nested add for sumThreeNumbers
    const innerAdd = {
      blockName: 'add',
      inputs: [
        inputVariables[Math.floor(Math.random() * inputVariables.length)],
        inputVariables[Math.floor(Math.random() * inputVariables.length)]
      ]
    };
    const outerAdd = {
      blockName: 'add',
      inputs: [
        innerAdd,
        inputVariables[Math.floor(Math.random() * inputVariables.length)]
      ]
    };
    await log(`Depth ${depth}: Generated nested add block ${JSON.stringify(outerAdd)}`, consoleLog);
    return outerAdd;
  }
  return await generateInput('number', depth, maxDepth, inputVariables, consoleLog);
}

export class ProgenyProgram {
  constructor(initialBlocks, inputVariables = [], consoleLog = false) {
    this.inputVariables = inputVariables;
    this.consoleLog = consoleLog;

    let processedBlocks = [];
    if (initialBlocks && initialBlocks.length > 0) {
      processedBlocks = initialBlocks.filter(block => {
        const isValid = isValidBlock(block, this.inputVariables, this.consoleLog);
        if (!isValid) {
          warn(`Invalid block provided to constructor, filtering out: ${JSON.stringify(block)}`, this.consoleLog);
        }
        return isValid;
      });
    }
    
    if (processedBlocks.length === 0) {
      warn(`Constructor received no valid blocks, creating ultra-simple sync default.`, this.consoleLog);
      processedBlocks = [
        {
          blockName: 'set',
          var: 'out',
          value: this.inputVariables.length > 0 ? this.inputVariables[0] : constants[0] 
        },
        { blockName: 'return', inputs: ['out'] }
      ];
    }

    this.blocks = processedBlocks;

    if (!this.blocks.some(b => b.blockName === 'return')) {
      this.blocks.push({ blockName: 'return', inputs: ['out'] });
      warn(`Appended default return block in constructor.`, this.consoleLog);
    }

    if (!this.blocks.every(block => isValidBlock(block, this.inputVariables, this.consoleLog))) {
      warn(`CRITICAL: Blocks in constructor are still invalid after processing and defaults: ${JSON.stringify(this.blocks)}. This should not happen.`, this.consoleLog);
      this.blocks = [
        {
          blockName: 'set',
          var: 'out',
          value: constants[0] 
        },
        { blockName: 'return', inputs: ['out'] }
      ];
    }
  }

  static async create(initialBlocks = [], inputVariables = [], consoleLog = false) {
    let blocksToConstruct;

    if (initialBlocks && initialBlocks.length > 0) {
      blocksToConstruct = initialBlocks;
    } else {
      const defaultValue = await generateInitialValue(inputVariables, 0, 2, consoleLog);
      blocksToConstruct = [
        {
          blockName: 'set',
          var: 'out',
          value: defaultValue 
        },
        {
          blockName: 'return',
          inputs: ['out']
        }
      ];
    }
    return new ProgenyProgram(blocksToConstruct, inputVariables, consoleLog);
  }

  async resolveInput(input, inputs, state, expectedType) {
    if (input === null || input === undefined) {
      await warn(`Null or undefined input for ${expectedType}`, this.consoleLog);
      return expectedType === 'boolean' ? false : 0;
    }
    if (typeof input === 'number' && expectedType === 'number') return input;
    if (typeof input === 'boolean' && expectedType === 'boolean') return input;
    if (typeof input === 'string') {
      if (expectedType === 'variable') {
        return variables.includes(input) || this.inputVariables.includes(input) ? input : variables[0];
      }
      if (expectedType === 'number' || expectedType === 'boolean') {
        const value = state.vars[input]; // Value sourced only from state.vars
        if (value === undefined) {
          await warn(`Undefined variable ${input} for ${expectedType}`, this.consoleLog);
          return expectedType === 'boolean' ? false : 0;
        }
        if ((expectedType === 'number' && typeof value === 'number') ||
            (expectedType === 'boolean' && typeof value === 'boolean')) {
          return value;
        }
        await warn(`Type mismatch for ${input}: expected ${expectedType}, got ${typeof value}`, this.consoleLog);
        return expectedType === 'boolean' ? false : 0;
      }
      if (expectedType === "'=='|'!='|'>'|'>='|'<'|'<='") {
        return operators.includes(input) ? input : '==';
      }
    }
    if (typeof input === 'object' && isValidBlock(input, this.inputVariables, this.consoleLog)) {
      const blockDef = blocksModule[input.blockName];
      if (blockDef.output === 'number' && expectedType === 'number') {
        return await this.executeBlock(input, inputs, state);
      }
      if (blockDef.output === 'boolean' && expectedType === 'boolean') {
        return await this.executeBlock(input, inputs, state);
      }
      if (input.blockName === 'get' && expectedType === 'number') {
        const key = input.inputs && input.inputs[0];
        if (!key || !(variables.includes(key) || this.inputVariables.includes(key))) {
          await warn(`Invalid variable for get: ${key || 'undefined'} in block ${JSON.stringify(input)}`, this.consoleLog);
          return 0;
        }
        const value = state.vars[key]; // Value sourced only from state.vars
        if (typeof value === 'number') {
          return value;
        }
        await warn(`Type mismatch for get(${key}): expected number, got ${typeof value}`, this.consoleLog);
        return 0;
      }
      // Handle 'get' block for expectedType 'boolean'
      if (input.blockName === 'get' && expectedType === 'boolean') {
        const key = input.inputs && input.inputs[0];
        if (!key || !(variables.includes(key) || this.inputVariables.includes(key))) {
          await warn(`Invalid variable for get: ${key || 'undefined'} in block ${JSON.stringify(input)}`, this.consoleLog);
          return false; // Default boolean value
        }
        const value = state.vars[key]; // Value sourced only from state.vars
        if (typeof value === 'boolean') {
          return value;
        }
        await warn(`Type mismatch for get(${key}): expected boolean, got ${typeof value}`, this.consoleLog);
        return false; // Default boolean value
      }
    }
    await warn(`Invalid input for ${expectedType}: ${JSON.stringify(input)} (type: ${typeof input})`, this.consoleLog);
    return expectedType === 'boolean' ? false : 0;
  }

  async executeBlock(block, runTimeInputs, state) {
    if (!isValidBlock(block, this.inputVariables, this.consoleLog)) {
      await warn(`Executing invalid block: ${JSON.stringify(block)}`, this.consoleLog);
      return null; 
    }

    const blockName = block.blockName;

    // Handle special blocks first
    if (blockName === 'set') {
      const varType = block.var.startsWith('b') ? 'boolean' : 'number';
      state.vars[block.var] = await this.resolveInput(block.value, runTimeInputs, state, varType);
      return; 
    }
    
    if (blockName === 'return') {
      const valueToReturn = await this.resolveInput(block.inputs[0], runTimeInputs, state, 'number');
      state.output = valueToReturn;
      return; 
    }

    if (blockName === 'if') {
      const condition = await this.resolveInput(block.condition, runTimeInputs, state, 'boolean');
      if (condition) {
        for (const action of (block.actions || [])) {
          await this.executeBlock(action, runTimeInputs, state);
        }
      }
      return; 
    }

    if (blockName === 'ifElse') {
      const condition = await this.resolveInput(block.condition, runTimeInputs, state, 'boolean');
      const actionsToExecute = condition ? (block.actions || []) : (block.elseActions || []);
      for (const action of actionsToExecute) {
        await this.executeBlock(action, runTimeInputs, state);
      }
      return; 
    }

    // For all other blocks, assume they are defined in blocksModule and are reporters (have output)
    const blockDef = blocksModule[blockName];

    if (!blockDef.output) {
      // Handles stack commands from blocksModule that are not 'set'/'if'/'return'
      await error(`Block '${blockName}' from blocksModule has no 'output' and is not a handled special block. Executing its action if available.`, this.consoleLog);
      if (blockDef.action && typeof blockDef.action === 'function') {
         const resolvedInputsForStackAction = block.inputs 
            ? await Promise.all(block.inputs.map((input, i) => this.resolveInput(input, runTimeInputs, state, blockDef.inputs[i])))
            : [];
         blockDef.action(...resolvedInputsForStackAction, state); 
      }
      return; 
    }
    
    // If we reach here, blockDef.output IS defined (it's a reporter).
    let resolvedInputs = [];
    if (blockDef.inputs) { // Only try to resolve inputs if blockDef defines them
        if (Array.isArray(block.inputs)) { // And if the block instance has an inputs array
            resolvedInputs = await Promise.all(
                block.inputs.map((input, i) => this.resolveInput(input, runTimeInputs, state, blockDef.inputs[i]))
            );
        } else if (block.inputs && block.inputs.length > 0) { 
            // Instance has inputs but it's not an array, or def has inputs but instance doesn't and def expects them
            // This case should ideally be caught by isValidBlock, but as a safeguard:
            await error(`Block '${blockName}' input structure mismatch. Def inputs: ${JSON.stringify(blockDef.inputs)}, Instance inputs: ${JSON.stringify(block.inputs)}. Block: ${JSON.stringify(block)}`, this.consoleLog);
            return blockDef.output === 'boolean' ? false : 0; // Default based on output type
        }
        // If blockDef.inputs is defined but block.inputs is not (or empty), and blockDef.inputs is not empty,
        // it implies missing inputs, which should also be caught by isValidBlock.
        // For simplicity here, assume if blockDef.inputs exists, resolvedInputs will be populated or remain [] if block.inputs is missing/empty.
    } else if (block.inputs && block.inputs.length > 0) {
        // Block definition has no inputs (e.g., 'pi'), but the instance has them.
        await error(`Block '${blockName}' instance has inputs, but definition does not. Inputs ignored. Block: ${JSON.stringify(block)}`, this.consoleLog);
        // resolvedInputs remains [].
    }

    if (typeof blockDef.action === 'function') { 
      return blockDef.action(...resolvedInputs, state); 
    } else {
      // Not a function, so blockDef.action is the constant value itself.
      if (resolvedInputs.length > 0 && blockDef.inputs && blockDef.inputs.length > 0) {
        // This means blockDef specified inputs, they were resolved, but action is not a function.
        // This would be a contradictory block definition (e.g. 'pi' defined with inputs).
        await warn(`Constant block '${blockName}' (action is not a function) had inputs defined and resolved. This is unusual. Inputs ignored.`, this.consoleLog);
      }
      return blockDef.action; // Return the constant value (e.g., Math.PI)
    }
  }

  async run(runTimeInputs) {
    const initialVars = {
      out: 0, v0: 0, v1: 0, v2: 0,
    };

    for (const varName of this.inputVariables) {
      if (runTimeInputs.hasOwnProperty(varName)) {
        initialVars[varName] = runTimeInputs[varName];
      } else {
        initialVars[varName] = 0;
        // Use a non-awaited warn if logger's warn is async and we're not in an async loop here.
        // For consistency with existing await log/warn, assuming it's fine.
        warn(`Input variable '${varName}' not provided in runTimeInputs, defaulting to 0.`, this.consoleLog);
      }
    }

    const state = {
      vars: initialVars,
      output: 0
    };

    for (const block of this.blocks) {
      if (isValidBlock(block, this.inputVariables, this.consoleLog)) {
        // Pass runTimeInputs for now, though resolveInput will ignore it for var lookups.
        // Other parts of executeBlock or resolveInput might theoretically use it, though unlikely for now.
        await this.executeBlock(block, runTimeInputs, state);
      }
    }
    return state.output;
  }

  static async generateRandomBlock(depth = 0, maxDepth = 2, isAction = false, targetVar = null, inputVariables = [], consoleLog = false) {
    const blockTypes = isAction
      ? Object.keys(blocksModule).filter(t => !blocksModule[t].output && t !== 'return' && t !== 'set')
      : Object.keys(blocksModule).filter(t => blocksModule[t].output === 'number' && t !== 'get' && t !== 'return');
    
    // Removed the strong bias towards 'add' block generation.
    // Block selection is now uniformly random from the available blockTypes.

    const blockName = blockTypes[Math.floor(Math.random() * blockTypes.length)];
    const blockDef = blocksModule[blockName];
    const block = { blockName };

    if (blockName === 'set') {
      block.var = targetVar || variables[Math.floor(Math.random() * variables.length)];
      const expectedValueType = block.var.startsWith('b') ? 'boolean' : 'number';
      block.value = await generateInput(expectedValueType, depth + 1, maxDepth, inputVariables, consoleLog);
      if (!isValidValue(block.value, expectedValueType, inputVariables, consoleLog)) {
        await warn(`Invalid value for set block (expected ${expectedValueType}): ${JSON.stringify(block.value)}`, consoleLog);
        // Fallback to a type-appropriate constant
        if (expectedValueType === 'boolean') {
          block.value = booleanConstants[Math.floor(Math.random() * booleanConstants.length)];
        } else {
          block.value = inputVariables.length > 0 && typeof inputVariables[0] === 'number' ? inputVariables[0] : constants[0];
        }
      }
    } else if (blockDef.inputs) {
      block.inputs = await Promise.all(blockDef.inputs.map(async inputType => {
        const input = await generateInput(inputType, depth + 1, maxDepth, inputVariables, consoleLog);
        if (!isValidValue(input, inputType, inputVariables, consoleLog)) {
          await warn(`Invalid input for ${blockName}: ${JSON.stringify(input)}`, consoleLog);
          return inputType === 'number' ? constants[0] : inputType === 'boolean' ? false : variables[0];
        }
        return input;
      }));
    }

    if (!isValidBlock(block, inputVariables, consoleLog)) {
      await warn(`Generated invalid block ${JSON.stringify(block)} at depth ${depth}`, consoleLog);
      return { blockName: 'set', var: targetVar || variables[0], value: inputVariables.length > 0 ? inputVariables[0] : constants[0] };
    }
    await log(`Depth ${depth}: Generated block ${blockName} ${block.inputs ? 'with inputs ' + JSON.stringify(block.inputs) : ''}${block.var ? ' var ' + block.var : ''}${block.value ? ' value ' + JSON.stringify(block.value) : ''}`, consoleLog);
    return block;
  }

  async mutate() {
    const newBlocks = [...this.blocks];
    if (Math.random() < 0.7) {
      const setIndex = newBlocks.findIndex(b => b.blockName === 'set' && b.var === 'out');
      if (setIndex >= 0) {
        const newValue = await generateInitialValue(this.inputVariables, 0, 2, this.consoleLog);
        if (isValidValue(newValue, 'number', this.inputVariables, this.consoleLog)) {
          newBlocks[setIndex].value = newValue;
        } else {
          await warn(`Invalid new value for set out: ${JSON.stringify(newValue)}`, this.consoleLog);
          newBlocks[setIndex].value = this.inputVariables.length > 0
            ? this.inputVariables[Math.floor(Math.random() * this.inputVariables.length)]
            : constants[0];
        }
      }
    } else {
      const setIndex = newBlocks.findIndex(b => b.blockName === 'set' && b.var === 'out');
      if (setIndex >= 0 && typeof newBlocks[setIndex].value === 'object' && isValidBlock(newBlocks[setIndex].value, this.inputVariables, this.consoleLog)) {
        const reporterBlock = findReporterBlock(newBlocks[setIndex].value);
        if (reporterBlock) {
          const usedVars = newBlocks.filter(b => b.var).map(b => b.var);
          const newVar = variables.filter(v => v !== 'out' && !usedVars.includes(v))[0] || `v${usedVars.length}`;
          const newSetBlock = {
            blockName: 'set',
            var: newVar,
            value: reporterBlock.block
          };
          if (isValidBlock(newSetBlock, this.inputVariables, this.consoleLog)) {
            replaceReporterBlock(newBlocks[setIndex].value, reporterBlock.path, { blockName: 'get', inputs: [newVar] });
            newBlocks.splice(setIndex, 0, newSetBlock);
          } else {
            await warn(`Invalid new set block in mutation: ${JSON.stringify(newSetBlock)}`, this.consoleLog);
          }
        }
      }
    }
    this.blocks = newBlocks.filter(block => isValidBlock(block, this.inputVariables, this.consoleLog));
    if (this.blocks.length === 0 || !this.blocks.some(b => b.blockName === 'return')) {
      await warn(`Reset to default blocks after mutation: ${JSON.stringify(this.blocks)}`, this.consoleLog);
      this.blocks = [
        {
          blockName: 'set',
          var: 'out',
          value: await generateInitialValue(this.inputVariables, 0, 2, this.consoleLog)
        },
        {
          blockName: 'return',
          inputs: ['out']
        }
      ];
    }
    if (!this.blocks.every(block => isValidBlock(block, this.inputVariables, this.consoleLog))) {
      await warn(`Invalid blocks after mutation: ${JSON.stringify(this.blocks)}`, this.consoleLog);
      this.blocks = [
        {
          blockName: 'set',
          var: 'out',
          value: await generateInitialValue(this.inputVariables, 0, 2, this.consoleLog)
        },
        {
          blockName: 'return',
          inputs: ['out']
        }
      ];
    }
  }
}

function findReporterBlock(block, path = []) {
  if (!block || typeof block !== 'object' || !block.blockName) return null;
  const blockDef = blocksModule[block.blockName];
  if (blockDef?.output === 'number') return { block, path };
  if (block.inputs) {
    for (let i = 0; i < block.inputs.length; i++) {
      if (typeof block.inputs[i] === 'object') {
        const result = findReporterBlock(block.inputs[i], [...path, i]);
        if (result) return result;
      }
    }
  }
  return null;
}

function replaceReporterBlock(block, path, replacement) {
  if (path.length === 0) {
    block.blockName = replacement.blockName;
    block.inputs = replacement.inputs;
    return;
  }
  const index = path[0];
  if (block.inputs && block.inputs[index]) {
    if (path.length === 1) {
      block.inputs[index] = replacement;
    } else {
      replaceReporterBlock(block.inputs[index], path.slice(1), replacement);
    }
  }
}