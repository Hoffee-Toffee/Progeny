import readline from 'readline';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { tests } from './tests.js';
import { Progeny } from './genetic-algorithm.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(__dirname, 'out');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: chalk.cyan('Progeny> '),
});

const commands = {
  help: {
    aliases: ['h'],
    description: 'Show available commands',
    action: () => {
      console.log(chalk.yellow('Available commands:'));
      for (const [
        cmd,
        { aliases = [], flags = [], description },
      ] of Object.entries(commands)) {
        console.log(
          `  ${
            chalk.green(cmd) +
            flags
              .map((flag) =>
                chalk.gray(` <${flag.map((f) => chalk.blue(f)).join('|')}>`)
              )
              .join('')
          }\n    ${description}`
        );
        if (aliases.length > 0) {
          console.log(
            chalk.gray(
              `    alias${aliases.length > 1 ? 'es' : ''}: ${aliases
                .map((a) => chalk.green(a))
                .join(', ')}`
            )
          );
        }
        console.log();
      }
    },
  },
  run: {
    aliases: ['r'],
    flags: [['--fresh', '-f'], ['--console', '-c'], ['--trials', '-t']],
    description: 'Run genetic algorithm for a test case (e.g., sumThreeNumbers)',
    action: async (args) => {
      const fresh = args.includes('--fresh') || args.includes('-f');
      const consoleLog = args.includes('--console') || args.includes('-c');
      
      // Trials processing
      let trials = 1; // Default to 1 trial
      const trialsIndex = args.findIndex(a => a === '--trials' || a === '-t');
      if (trialsIndex >= 0 && args[trialsIndex + 1]) {
        const parsedTrials = parseInt(args[trialsIndex + 1], 10);
        if (!isNaN(parsedTrials) && parsedTrials > 0) {
          trials = parsedTrials;
        } else {
          console.log(chalk.yellow(`Invalid value for trials. Using default: ${trials}.`));
        }
      }

      // Test case name processing
      // Argument for testCaseName is one that is not a flag and not the value for --trials/-t
      const testCaseNameInput = args.find(a => 
        !a.startsWith('-') && 
        !(trialsIndex >= 0 && a === args[trialsIndex + 1]) 
      );

      let testCaseName;
      const availableTestNames = Object.keys(tests);

      if (testCaseNameInput) {
        testCaseName = testCaseNameInput;
      } else {
        if (availableTestNames.length > 0) {
          testCaseName = availableTestNames[0]; // Default to the first test case
          console.log(chalk.blue(`No test case specified, defaulting to: ${testCaseName}`));
        } else {
          console.log(chalk.red('No test cases available.'));
          return;
        }
      }

      const testCase = tests[testCaseName];

      if (!testCase) {
        console.log(chalk.red(`Unknown or unavailable test case: ${testCaseName}. Available: ${availableTestNames.join(', ')}`));
        return;
      }

      try {
        const progeny = new Progeny(100, 50, consoleLog);
        await progeny.run(testCase, trials);
        console.log(chalk.green('\nGenetic algorithm completed successfully.\n'));
      } catch (error) {
        console.error(chalk.red(`Error running genetic algorithm: ${error.message}`));
      }
    },
  },
  logs: {
    aliases: ['l'],
    description: 'Parse progeny.log and create JSON files for each test case',
    action: async () => {
      try {
        const logFile = path.join(__dirname, 'progeny.log');
        let logData = [];
        try {
          await fs.access(logFile);
          const logContent = await fs.readFile(logFile, 'utf8');
          logData = logContent
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
              const match = line.match(/^\[([^\]]+)\] (?:WARN: |ERROR: )?(.+)$/);
              if (!match) return null;
              const [, timestamp, message] = match;
              const testCaseMatch = message.match(/Trial \d+\/\d+.*?(sumThreeNumbers|squareNumber|multiplyBy4Subtract2|quadraticEquation|conditionalOutput|absoluteValue)/);
              const testCase = testCaseMatch ? testCaseMatch[1] : 'unknown';
              return { timestamp, message, testCase };
            })
            .filter(entry => entry);
        } catch (error) {
          console.warn(chalk.yellow(`Warning: Log file ${logFile} not found`));
          return;
        }

        // Group by test case
        const testCases = [...new Set(logData.map(entry => entry.testCase))];
        for (const testCase of testCases) {
          const entries = logData.filter(entry => entry.testCase === testCase);
          const outputFile = path.join(outputDir, `${testCase}_log.json`);
          if (entries.length > 0) {
            await fs.mkdir(outputDir, { recursive: true });
            await fs.writeFile(outputFile, JSON.stringify(entries, null, 2));
            console.log(chalk.green(`Generated ${outputFile} with ${entries.length} entries`));
          } else {
            console.warn(chalk.yellow(`No entries for test case ${testCase}`));
          }
        }

        if (testCases.length === 0) {
          console.warn(chalk.yellow('No valid test cases found in logs'));
        } else {
          console.log(chalk.green('\nLog files processed successfully.\n'));
        }
      } catch (error) {
        console.error(chalk.red(`Error processing logs: ${error.message}`));
      }
    },
  },
  clear: {
    aliases: ['c'],
    description: 'Clear the terminal',
    action: () => {
      console.clear();
      console.log(chalk.yellow('\nTerminal cleared.\n'));
    },
  },
  exit: {
    description: 'Exit the Progeny CLI',
    action: () => {
      rl.close();
    },
  },
};

const aliases = Object.entries(commands).reduce(
  (acc, [cmd, { aliases = [] }]) => {
    aliases.forEach(alias => (acc[alias] = cmd));
    return acc;
  },
  {}
);

process.on('SIGINT', () => {
  console.log(chalk.green('\nExiting Progeny CLI'));
  rl.close();
});

console.log(
  chalk.bold.green(
    '\nWelcome to Progeny CLI. Type "help" for available commands.\n'
  )
);
rl.prompt();

rl.on('line', async (line) => {
  const input = line.trim();
  const [cmd, ...args] = input.split(/\s+/);
  const resolvedCmd = aliases[cmd.toLowerCase()] || cmd.toLowerCase();
  const command = commands[resolvedCmd];

  if (command) {
    console.log();
    await command.action(args);
  } else {
    console.log(
      chalk.red(
        `Unknown command or alias: ${cmd}. Type "help" for available commands.`
      )
    );
  }

  rl.prompt();
}).on('close', () => {
  console.log(chalk.yellow('\nExiting Progeny CLI'));
  process.exit(0);
});