import { spawnSync } from 'node:child_process';

function resolveCommand() {
  if (process.platform === 'win32') {
    return {
      command: 'powershell',
      args: ['-ExecutionPolicy', 'Bypass', '-File', 'scripts/install-mobile.ps1', ...process.argv.slice(2)],
    };
  }

  if (process.platform === 'darwin') {
    return {
      command: 'bash',
      args: ['scripts/install-mobile-macos.sh', ...process.argv.slice(2)],
    };
  }

  return {
    command: 'bash',
    args: ['scripts/install-mobile.sh', ...process.argv.slice(2)],
  };
}

const { command, args } = resolveCommand();
const result = spawnSync(command, args, { stdio: 'inherit' });

if (result.error) {
  console.error(result.error.message);
  process.exit(typeof result.status === 'number' ? result.status : 1);
}

process.exit(result.status ?? 0);
