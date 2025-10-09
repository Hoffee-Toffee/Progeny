import { Progeny } from '../functions/genetic-algorithm.ts'
import { useContext, useEffect, useRef, useState } from 'react';
import { LoadingContext } from './App.tsx';
import '../styles/home.scss';

import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';

import blocks from '../files/blocks.ts';

// Category color mapping (moved from blockColors.ts)
const blockCategoryColors: Record<string, number> = {
  Math: 230,
  Logic: 210,
  Variables: 120,
  Functions: 290,
  Output: 20,
  // Add more categories as needed
};
import { tests, TestProblem } from '../files/tests.ts';
import { faCopy, faDownload } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';


export default function Home() {
  const readOnlyDiv = useRef<HTMLDivElement>(null);
  const [readOnlyWorkspace, setReadOnlyWorkspace] = useState<any>(null);
  // For now, just one member: the main block for the selected test
  const [selectedMember, setSelectedMember] = useState('main');
  const { isPageLoaded, setIsPageLoaded } = useContext(LoadingContext);
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const [generatedCode, setGeneratedCode] = useState('');
  const [selectedTestKey, setSelectedTestKey] = useState<string>(Object.keys(tests)[0]);
  const [selectedTest, setSelectedTest] = useState<TestProblem<any, any>>(tests[Object.keys(tests)[0]]);
  const [runResult, setRunResult] = useState<string | null>(null);
  // Config state for run parameters
  const [config, setConfig] = useState({
    populationSize: 25,
    maxGenerations: 10,
    mutationRate: 0.3,
    evaluationCasesCount: 20,
    numEvaluationBatches: 5,
  });

  // --- MOVE ALL HOOKS TO TOP LEVEL ---
  useEffect(() => {
    if (!isPageLoaded) setIsPageLoaded(true);
  }, [isPageLoaded, setIsPageLoaded]);

  useEffect(() => {
    if (!readOnlyDiv.current) return;
    if (!Blockly) return;
    if (readOnlyWorkspace) {
      readOnlyWorkspace.dispose();
    }
    const toolboxXml = document.createElement('xml');
    toolboxXml.style.display = 'none';
    const mainInputNames = selectedTest.inputs.map(i => i.name);
    const mainInputTypes = selectedTest.inputs.map(i => i.type);
    const mainBlockType = 'custom_main';
    const mainBlockDef: any = {
      type: mainBlockType,
      message0: `main with: ${mainInputNames.join(', ')}`,
      args0: [],
      message1: '%1 return %2',
      args1: [
        { type: 'input_statement', name: 'DO' },
        { type: 'input_value', name: 'RETURN', check: mainInputTypes.every(t => t === 'number') ? 'Number' : undefined },
      ],
      colour: 242,
      tooltip: `Main function with ${mainInputNames.length} input${mainInputNames.length > 1 ? 's' : ''}: ${mainInputNames.join(', ')}`,
      helpUrl: '',
      jsGenerator: function () { return ''; },
      mutations: [],
    };
    Blockly.defineBlocksWithJsonArray([mainBlockDef]);
    const blockElem = document.createElement('block');
    blockElem.setAttribute('type', mainBlockType);
    toolboxXml.appendChild(blockElem);
    const ws = Blockly.inject(readOnlyDiv.current, {
      toolbox: toolboxXml,
      readOnly: true,
      renderer: 'zelos',
      theme: Blockly.Themes.Classic,
    });
    const mainBlock = ws.newBlock(mainBlockType);
    mainBlock.setDeletable(false);
    mainBlock.setMovable(false);
    if (mainBlock.setEditable) mainBlock.setEditable(false);
    mainBlock.initSvg();
    mainBlock.moveBy(40, 40);
    setReadOnlyWorkspace(ws);
    return () => {
      ws.dispose();
    };
  }, [selectedTestKey, selectedMember]);
  // Handler for starting a run (stub for now)
  const handleStartRun = async () => {
    setRunResult('Running...')
    // Run the genetic algorithm with the selected config and test
    const progeny = new Progeny(
      config.populationSize,
      config.maxGenerations,
      true, // consoleLog
      config.evaluationCasesCount,
      config.numEvaluationBatches,
      config.mutationRate,
    )
    const testCase = selectedTest
    // Use the first test for now (can expand to allow user selection)
    const best = await progeny.run(testCase)
    if (best) {
      const fitness = await progeny.evaluate(best, testCase)
      const resultText =
        'Best Program Found!\nFitness: ' +
        fitness.toFixed(4) +
        '\nBlocks: ' +
        JSON.stringify(best.blocks, null, 2)
      setRunResult(resultText)
    } else {
      setRunResult('No best program found.')
    }
  }
  // Copy/download handlers
  const handleCopy = () => {
    if (generatedCode) navigator.clipboard.writeText(generatedCode);
  };
  const handleDownload = () => {
    if (!generatedCode) return;
    const blob = new Blob([generatedCode], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTestKey}.js`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  // Read-only Blockly editor for config member
  useEffect(() => {
    if (!readOnlyDiv.current) return;
    if (!Blockly) return;
    // Clean up previous workspace
    if (readOnlyWorkspace) {
      readOnlyWorkspace.dispose();
    }
    // Minimal toolbox for read-only
    const toolboxXml = document.createElement('xml');
    toolboxXml.style.display = 'none';
    // Only show the main block for now
    const mainInputNames = selectedTest.inputs.map(i => i.name);
    const mainInputTypes = selectedTest.inputs.map(i => i.type);
    const mainBlockType = 'custom_main';
    const mainBlockDef: any = {
      type: mainBlockType,
      message0: `main with: ${mainInputNames.join(', ')}`,
      args0: [],
      message1: '%1 return %2',
      args1: [
        { type: 'input_statement', name: 'DO' },
        { type: 'input_value', name: 'RETURN', check: mainInputTypes.every(t => t === 'number') ? 'Number' : undefined },
      ],
      colour: 242,
      tooltip: `Main function with ${mainInputNames.length} input${mainInputNames.length > 1 ? 's' : ''}: ${mainInputNames.join(', ')}`,
      helpUrl: '',
      jsGenerator: function () { return ''; },
      mutations: [],
    };
    Blockly.defineBlocksWithJsonArray([mainBlockDef]);
    const blockElem = document.createElement('block');
    blockElem.setAttribute('type', mainBlockType);
    toolboxXml.appendChild(blockElem);
    // Inject read-only workspace
    const ws = Blockly.inject(readOnlyDiv.current, {
      toolbox: toolboxXml,
      readOnly: true,
      renderer: 'zelos',
      theme: Blockly.Themes.Classic,
    });
    // Add the main block
    const mainBlock = ws.newBlock(mainBlockType);
    mainBlock.setDeletable(false);
    mainBlock.setMovable(false);
    if (mainBlock.setEditable) mainBlock.setEditable(false);
    mainBlock.initSvg();
    mainBlock.moveBy(40, 40);
    setReadOnlyWorkspace(ws);


    return () => {
      ws.dispose();


    };
  }, [selectedTestKey, selectedMember]);


  // Main Blockly editor initialization in useEffect
  useEffect(() => {
    if (!blocklyDiv.current) {
      console.error('blocklyDiv.current is null, skipping Blockly.inject');
      return;
    }

    // Register blocks and generators (except main)
    const blockDefinitions: any[] = [];
    const toolboxXml = document.createElement('xml');
    toolboxXml.id = 'toolbox';
    toolboxXml.style.display = 'none';

    // Group blocks by category
    const blocksByCategory: Record<string, [string, any][]> = {};
    Object.entries(blocks).forEach(([type, block]: [string, any]) => {
      if (!blocksByCategory[block.category]) blocksByCategory[block.category] = [];
      blocksByCategory[block.category].push([type, block]);
    });
    Object.entries(blocksByCategory).forEach(([category, blockList]) => {
      blockList.forEach(([type, block]) => {
        const fullType = `custom_${type}`;
        const { jsGenerator, mutations, ...blockDefRest } = block;
        const blockDef = {
          type: fullType,
          colour: blockCategoryColors[category] || 242,
          tooltip: block.tooltip || '',
          helpUrl: block.helpUrl || '',
          ...blockDefRest,
        };
        blockDefinitions.push(blockDef);
        if (typeof block.jsGenerator === 'function') {
          javascriptGenerator.forBlock[fullType] = block.jsGenerator;
        }
      });
    });

    // Dynamically add main block for the selected test
    const mainInputNames = selectedTest.inputs.map(i => i.name);
    const mainInputTypes = selectedTest.inputs.map(i => i.type);
    const mainBlockType = 'custom_main';
    const mainBlockDef: any = {
      type: mainBlockType,
      message0: `main with: ${mainInputNames.join(', ')}`,
      args0: [],
      message1: '%1 return %2',
      args1: [
        {
          type: 'input_statement',
          name: 'DO',
        },
        {
          type: 'input_value',
          name: 'RETURN',
          check: mainInputTypes.every(t => t === 'number') ? 'Number' : undefined,
        },
      ],
      colour: 242, // Lavender, visible and matches previous theme
      tooltip: `Main function with ${mainInputNames.length} input${mainInputNames.length > 1 ? 's' : ''}: ${mainInputNames.join(', ')}`,
      helpUrl: '',
      jsGenerator: function (block: any, generator: any) {
        const statements = generator.statementToCode(block, 'DO');
        const returnValue = generator.valueToCode(block, 'RETURN', generator.ORDER_NONE) || (mainInputTypes.every(t => t === 'number') ? '0' : 'false');
        return `function main(${mainInputNames.join(', ')}) {\n${statements}  return ${returnValue};\n}\n`;
      },
      mutations: [],
    };
    blockDefinitions.push(mainBlockDef);
    javascriptGenerator.forBlock[mainBlockType] = mainBlockDef.jsGenerator;

    // Build toolbox XML (add main block to Functions category)
    Object.entries(blocksByCategory).forEach(([category, blockList]) => {
      const catElem = document.createElement('category');
      catElem.setAttribute('name', category);
      catElem.setAttribute('colour', (blockCategoryColors[category] || 242).toString());
      blockList.forEach(([type]) => {
        const fullType = `custom_${type}`;
        const blockElem = document.createElement('block');
        blockElem.setAttribute('type', fullType);
        catElem.appendChild(blockElem);
      });
      // Add main block to Functions category
      if (category === 'Functions') {
        const blockElem = document.createElement('block');
        blockElem.setAttribute('type', mainBlockType);
        catElem.appendChild(blockElem);
      }
      toolboxXml.appendChild(catElem);
    });

    try {
      Blockly.defineBlocksWithJsonArray(blockDefinitions);
    } catch (error) {
      console.error('Failed to define blocks:', error);
      return;
    }

    // Log the full toolbox XML for debugging
    console.log('[Blockly Debug] Full toolbox XML:', toolboxXml.outerHTML);
    // Initialize workspace
    let workspace: Blockly.WorkspaceSvg | null = null;
    try {
      workspace = Blockly.inject(blocklyDiv.current, {
        grid: { spacing: 20, length: 3, colour: '#ccc', snap: true },
        toolbox: toolboxXml,
        renderer: 'zelos',
        theme: Blockly.Themes.Classic,
      });
      workspaceRef.current = workspace;
      console.log('Workspace injected successfully');
    } catch (error) {
      console.error('Failed to inject Blockly workspace:', error);
      return;
    }

    // Create variables for the selected test
    try {
      const variableMap = workspace.getVariableMap();
      variableMap.getAllVariables().forEach(v => variableMap.deleteVariable(v));
      selectedTest.inputs.forEach(input => {
        if (input.type === 'number') {
          variableMap.createVariable(input.name, 'Number');
        } else if (input.type === 'boolean') {
          variableMap.createVariable(input.name, 'Boolean');
        }
      });
    } catch (error) {
      console.error('Failed to create variables:', error);
    }

    // Initialize main block for the selected test
    try {
      if (!Blockly.Blocks[mainBlockType]) {
        console.error('Cannot initialize main block: custom_main not registered');
        return;
      }
      const mainBlock = workspace.newBlock(mainBlockType);
      if (!mainBlock) {
        console.error('Failed to create main block instance');
        return;
      }
      mainBlock.setDeletable(false);
      mainBlock.setMovable(true);
      if (mainBlock.setDisabledReason) mainBlock.setDisabledReason(false, '');
      mainBlock.initSvg();
      mainBlock.moveBy(50, 50);
    } catch (error) {
      console.error('Error initializing main block:', error);
      return;
    }

    // Prevent duplicate main blocks
    workspace.addChangeListener((event: any) => {
      if (event.type === Blockly.Events.BLOCK_CREATE && event.blockType === 'custom_main') {
        const blocks = workspace!.getAllBlocks();
        const mainBlocks = blocks.filter((b) => b.type === 'custom_main');
        if (mainBlocks.length > 1) {
          console.log('Duplicate main block detected, disposing extras');
          mainBlocks.slice(1).forEach((b) => b.dispose());
        }
      }
      try {
        // Only generate code from the main block
        const mainBlock = workspace!.getAllBlocks().find((b) => b.type === 'custom_main');
        let code = '';
        // Ensure generator.nameDB_ is initialized
        if (mainBlock) {
          // Ensure generator is initialized
          if (workspace && !javascriptGenerator.nameDB_) {
            javascriptGenerator.init(workspace);
          }
          const result = javascriptGenerator.blockToCode(mainBlock);
          code = Array.isArray(result) ? result[0] : result;
        }
        setGeneratedCode((code?.trim() && typeof code === 'string') ? code.trim() : '// No code generated');
      } catch (error) {
        console.error('Error generating code:', error);
        setGeneratedCode('// Error generating code');
      }
    });

    // Cleanup on unmount or dependency change
    return () => {
      if (workspace) {
        workspace.dispose();
      }
      if (toolboxXml.parentNode) {
        toolboxXml.parentNode.removeChild(toolboxXml);
      }
    };
  }, [blocklyDiv, selectedTestKey, selectedMember, selectedTest]);


  useEffect(() => {
    if (!isPageLoaded) setIsPageLoaded(true);
  }, [isPageLoaded, setIsPageLoaded]);

  return (
    <main className="blockly-home-main blockly-home-scrollable">
      <h1 className="blockly-home-title">Progeny</h1>
      {/* Config panel for run parameters */}
      <form className="blockly-home-config-panel" style={{
        display: 'flex', gap: '2em', alignItems: 'center', marginBottom: '1.5em', flexWrap: 'wrap',
        background: '#f4f4fa', borderRadius: '0.7em', padding: '1em 1.5em', boxShadow: '0 1px 6px rgba(0,0,0,0.04)'
      }} onSubmit={e => e.preventDefault()}>
        <label style={{ fontWeight: 500 }}>
          Population Size:
          <input type="number" min={2} max={1000} step={1} value={config.populationSize}
            onChange={e => setConfig(c => ({ ...c, populationSize: Number(e.target.value) }))}
            style={{ marginLeft: 8, width: 70 }}
          />
        </label>
        <label style={{ fontWeight: 500 }}>
          Generations:
          <input type="number" min={1} max={500} step={1} value={config.maxGenerations}
            onChange={e => setConfig(c => ({ ...c, maxGenerations: Number(e.target.value) }))}
            style={{ marginLeft: 8, width: 60 }}
          />
        </label>
        <label style={{ fontWeight: 500 }}>
          Mutation Rate:
          <input type="number" min={0} max={1} step={0.01} value={config.mutationRate}
            onChange={e => setConfig(c => ({ ...c, mutationRate: Number(e.target.value) }))}
            style={{ marginLeft: 8, width: 60 }}
          />
        </label>
        <label style={{ fontWeight: 500 }}>
          Eval Cases:
          <input type="number" min={1} max={100} step={1} value={config.evaluationCasesCount}
            onChange={e => setConfig(c => ({ ...c, evaluationCasesCount: Number(e.target.value) }))}
            style={{ marginLeft: 8, width: 60 }}
          />
        </label>
        <label style={{ fontWeight: 500 }}>
          Eval Batches:
          <input type="number" min={1} max={20} step={1} value={config.numEvaluationBatches}
            onChange={e => setConfig(c => ({ ...c, numEvaluationBatches: Number(e.target.value) }))}
            style={{ marginLeft: 8, width: 60 }}
          />
        </label>
        <button
          type="button"
          style={{
            marginLeft: '2em', padding: '0.5em 1.5em', fontWeight: 600, fontSize: '1.1em', borderRadius: '0.4em', border: 'none', background: '#7a5cff', color: '#fff', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.07)'
          }}
          onClick={handleStartRun}
        >
          Start Run
        </button>
      </form>
      {runResult && (
        <div className="run-result" style={{ marginTop: '1em', padding: '1em', background: '#e8f5e9', borderRadius: '0.5em', whiteSpace: 'pre-wrap' }}>
          {runResult}
        </div>
      )}
      <div className="blockly-home-grid" style={{ gridTemplateColumns: '350px 1fr' }}>
        {/* Read-only config member viewer: only show if run data exists (e.g., after a run) */}
        {false && (
          <div style={{ gridColumn: '1 / 2', gridRow: '1 / 3', background: '#f8f9fb', borderRadius: '0.7em', boxShadow: '0 1px 6px rgba(0,0,0,0.04)', marginRight: '2em', padding: '1em 0.5em', minHeight: 420 }}>
            <div style={{ fontWeight: 600, fontSize: '1.1em', marginBottom: 8 }}>Config Member Viewer</div>
            <select value={selectedMember} onChange={e => setSelectedMember(e.target.value)} style={{ marginBottom: 12, width: '100%' }}>
              <option value="main">main (selected test)</option>
              {/* Future: map over config members */}
            </select>
            <div ref={readOnlyDiv} style={{ width: '100%', height: 340, background: '#fff', borderRadius: 8, border: '1px solid #eee' }} />
          </div>
        )}
        {/* Top left: Select problem */}
        <div className="blockly-home-grid-toolbar">
          <label htmlFor="test-select" className="blockly-home-select-label">Select Problem:&nbsp;</label>
          <select
            id="test-select"
            value={selectedTestKey}
            onChange={e => {
              setSelectedTestKey(e.target.value);
              setSelectedTest(tests[e.target.value]);
              setGeneratedCode('');
            }}
          >
            {Object.entries(tests).map(([key]) => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
        </div>
        {/* Top right: Generated JS label (styled as before) */}
        <div className="blockly-home-grid-jslabel">
          <h4 className="blockly-home-output-label">Generated JavaScript:</h4>
        </div>
        {/* Bottom left: Blockly editor */}
        <div className="blockly-home-grid-blockly">
          <div
            ref={blocklyDiv}
            id="blocklyDiv"
            className="blockly-home-blockly-area"
          />
        </div>
        {/* Bottom right: Generated JS output with icon buttons */}
        <div className="blockly-home-grid-output">
          <div className="blockly-home-output-actions">
            <button title="Copy code" onClick={handleCopy} className="blockly-home-jslabel-btn" aria-label="Copy code">
              <FontAwesomeIcon icon={faCopy} />
            </button>
            <button title="Download code" onClick={handleDownload} className="blockly-home-jslabel-btn" aria-label="Download code">
              <FontAwesomeIcon icon={faDownload} />
            </button>
          </div>
          <pre className="blockly-home-code-output">{generatedCode}</pre>
        </div>
      </div>
    </main>
  );
}

const workspaceRef = { current: null as Blockly.WorkspaceSvg | null };