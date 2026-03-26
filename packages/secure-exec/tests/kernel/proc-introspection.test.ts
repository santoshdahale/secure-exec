/**
 * Kernel-backed /proc integration tests.
 *
 * Verifies that sandboxed Node code can inspect process metadata and live
 * file descriptors through the kernel proc layer rather than through
 * test-only VFS scaffolding.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createKernel } from '../../../core/src/kernel/index.ts';
import type { Kernel } from '../../../core/src/kernel/index.ts';
import { InMemoryFileSystem } from '../../../browser/src/os-filesystem.ts';
import { createNodeRuntime } from '../../../nodejs/src/kernel-runtime.ts';

async function createNodeKernel(): Promise<{
  kernel: Kernel;
  vfs: InMemoryFileSystem;
  dispose: () => Promise<void>;
}> {
  const vfs = new InMemoryFileSystem();
  const kernel = createKernel({ filesystem: vfs });
  await kernel.mount(createNodeRuntime());
  return { kernel, vfs, dispose: () => kernel.dispose() };
}

async function runNodeScript(
  kernel: Kernel,
  code: string,
  options?: {
    cwd?: string;
    env?: Record<string, string>;
  },
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const proc = kernel.spawn('node', ['-e', code], {
    cwd: options?.cwd,
    env: options?.env,
    onStdout: (data) => stdout.push(new TextDecoder().decode(data)),
    onStderr: (data) => stderr.push(new TextDecoder().decode(data)),
  });

  const exitCode = await proc.wait();
  return {
    exitCode,
    stdout: stdout.join(''),
    stderr: stderr.join(''),
  };
}

function parseLastJsonLine<T>(stdout: string): T {
  const lines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return JSON.parse(lines.at(-1)!) as T;
}

describe('kernel /proc introspection', () => {
  let ctx: Awaited<ReturnType<typeof createNodeKernel>>;

  afterEach(async () => {
    await ctx?.dispose();
  });

  it('exposes cwd, exe, and environ through /proc/self', async () => {
    ctx = await createNodeKernel();

    const result = await runNodeScript(
      ctx.kernel,
      `
        const fs = require('node:fs');
        const environ = fs.readFileSync('/proc/self/environ');
        console.log(JSON.stringify({
          cwd: fs.readlinkSync('/proc/self/cwd'),
          exe: fs.readlinkSync('/proc/self/exe'),
          envEntries: environ.toString('utf8').split('\\0').filter(Boolean),
          endsWithNul: environ.length === 0 ? true : environ[environ.length - 1] === 0,
        }));
      `,
      {
        cwd: '/tmp/proc-introspection',
        env: {
          FOO: 'bar',
          BAZ: 'qux',
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');

    const payload = parseLastJsonLine<{
      cwd: string;
      exe: string;
      envEntries: string[];
      endsWithNul: boolean;
    }>(result.stdout);

    expect(payload.cwd).toBe('/tmp/proc-introspection');
    expect(payload.exe).toBe('/bin/node');
    expect(payload.envEntries).toContain('FOO=bar');
    expect(payload.envEntries).toContain('BAZ=qux');
    expect(payload.endsWithNul).toBe(true);
  });

  it('lists live FDs in /proc/self/fd and resolves fd symlinks', async () => {
    ctx = await createNodeKernel();
    const result = await runNodeScript(
      ctx.kernel,
      `
        const fs = require('node:fs');
        console.log(JSON.stringify({
          entries: fs.readdirSync('/proc/self/fd'),
          stdinTarget: fs.readlinkSync('/proc/self/fd/0'),
          stdoutTarget: fs.readlinkSync('/proc/self/fd/1'),
          stderrTarget: fs.readlinkSync('/proc/self/fd/2'),
        }));
      `,
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');

    const payload = parseLastJsonLine<{
      entries: string[];
      stdinTarget: string;
      stdoutTarget: string;
      stderrTarget: string;
    }>(result.stdout);

    expect(payload.entries).toContain('0');
    expect(payload.entries).toContain('1');
    expect(payload.entries).toContain('2');
    expect(payload.stdinTarget).toBe('/dev/stdin');
    expect(payload.stdoutTarget).toBe('/dev/stdout');
    expect(payload.stderrTarget).toBe('/dev/stderr');
  });
});
