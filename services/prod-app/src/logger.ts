/**
 * Minimal plain-text logger. prod-app deliberately emits human-readable single
 * lines (not JSON) to stdout/stderr, because the operator's collector streams
 * these lines straight to the Analyzer LLM — readable lines diagnose better.
 */
type Level = 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

function emit(level: Level, msg: string): void {
  const line = `${new Date().toISOString()} ${level} ${msg}`;
  if (level === 'ERROR' || level === 'FATAL' || level === 'WARN') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export const log = {
  info: (msg: string) => emit('INFO', msg),
  warn: (msg: string) => emit('WARN', msg),
  error: (msg: string) => emit('ERROR', msg),
  fatal: (msg: string) => emit('FATAL', msg),
};
