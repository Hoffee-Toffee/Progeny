export const log = (message: string, consoleLog = true) => {
  if (consoleLog) {
    console.log(message)
  }
}

export const warn = (message: string, consoleLog = true) => {
  if (consoleLog) {
    console.warn(message)
  }
}

export const error = (message: string, consoleLog = true) => {
  if (consoleLog) {
    console.error(message)
  }
}

export const close = () => {
  // Placeholder for closing log files or streams
}

export const logBestProgram = (program: string, consoleLog = true) => {
  if (consoleLog) {
    console.log('Best program:', program)
  }
}