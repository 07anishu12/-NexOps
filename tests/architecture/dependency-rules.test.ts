import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const ROOT_DIR = resolve(__dirname, '../..');

function getWorkspacePackages(): { name: string; path: string; dependencies: Record<string, string> }[] {
  const dirs = [
    ...readdirSync(join(ROOT_DIR, 'apps')).map((d) => ({ group: 'apps', dir: d })),
    ...readdirSync(join(ROOT_DIR, 'packages')).map((d) => ({ group: 'packages', dir: d }))
  ];

  const packages = [];
  for (const item of dirs) {
    const pkgJsonPath = join(ROOT_DIR, item.group, item.dir, 'package.json');
    try {
      const content = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
      packages.push({
        name: content.name,
        path: join(ROOT_DIR, item.group, item.dir),
        dependencies: {
          ...content.dependencies,
          ...content.devDependencies
        }
      });
    } catch {
      // Not a directory or no package.json
    }
  }
  return packages;
}

function getAllFiles(dir: string, extensions: string[] = ['.ts', '.tsx']): string[] {
  let results: string[] = [];
  const list = readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === 'dist' || file === '.next') continue;
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath, extensions));
    } else {
      if (extensions.some((ext) => file.endsWith(ext))) {
        results.push(filePath);
      }
    }
  }
  return results;
}

describe('Architecture & Dependency Boundaries', () => {
  const workspaces = getWorkspacePackages();

  it('prohibits browser-facing apps from declaring server-only dependencies', () => {
    const serverOnlyDependencies = [
      '@agentflow/auth',
      '@agentflow/billing',
      '@agentflow/config',
      '@agentflow/database',
      '@agentflow/integrations',
      '@agentflow/observability',
      '@agentflow/policy',
      '@agentflow/runtime',
      'drizzle-orm',
      'mysql2',
      'pg'
    ];

    for (const appName of ['@agentflow/web', '@agentflow/widget']) {
      const app = workspaces.find((workspace) => workspace.name === appName);
      expect(app, `Expected workspace ${appName} to exist`).toBeDefined();
      for (const dependency of serverOnlyDependencies) {
        expect(app?.dependencies[dependency], `${appName} declares server-only dependency ${dependency}`).toBeUndefined();
      }
    }
  });

  it('prohibits browser-facing source code from importing database or secret modules', () => {
    const browserDirs = [
      join(ROOT_DIR, 'apps/web/app'),
      join(ROOT_DIR, 'apps/widget/src')
    ];

    const forbiddenImports = [
      '@agentflow/auth',
      '@agentflow/config',
      '@agentflow/database',
      '@agentflow/integrations',
      '@agentflow/observability',
      '@agentflow/policy',
      '@agentflow/runtime',
      'drizzle-orm',
      'pg',
      'mysql2'
    ];

    for (const dir of browserDirs) {
      const files = getAllFiles(dir);
      for (const file of files) {
        const content = readFileSync(file, 'utf8');
        for (const forbidden of forbiddenImports) {
          const importRegex = new RegExp(`(?:from\\s+|import\\s*\\(\\s*|require\\(\\s*)['"]${forbidden}['"]`, 'g');
          expect(
            importRegex.test(content),
            `Security boundary violation: File ${file} imports forbidden module '${forbidden}'`
          ).toBe(false);
        }
      }
    }
  });

  it('prohibits cross-application relative imports between apps', () => {
    const appsDir = join(ROOT_DIR, 'apps');
    const files = getAllFiles(appsDir);

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      // Prohibit relative imports escaping the current app directory into another app.
      const crossAppImportRegex = /(?:from\s+|import\s*\(\s*|require\(\s*)['"]\.\.\/(\.\.\/)+apps\//g;
      expect(
        crossAppImportRegex.test(content),
        `Monorepo hygiene violation: File ${file} has cross-app relative import`
      ).toBe(false);
    }
  });

  it('detects and forbids circular dependencies across monorepo packages (DAG check)', () => {
    const internalPkgNames = workspaces.map((w) => w.name);
    const adjList: Record<string, string[]> = {};

    for (const pkg of workspaces) {
      adjList[pkg.name] = Object.keys(pkg.dependencies).filter((dep) =>
        internalPkgNames.includes(dep)
      );
    }

    // Standard DFS Cycle Detection for Directed Graphs
    const visited: Record<string, boolean> = {};
    const recStack: Record<string, boolean> = {};
    let cycleFound: string[] | null = null;

    function hasCycle(node: string, path: string[]): boolean {
      visited[node] = true;
      recStack[node] = true;

      for (const neighbor of adjList[node] ?? []) {
        if (!visited[neighbor]) {
          if (hasCycle(neighbor, [...path, neighbor])) return true;
        } else if (recStack[neighbor]) {
          cycleFound = [...path, neighbor];
          return true;
        }
      }

      recStack[node] = false;
      return false;
    }

    for (const pkg of workspaces) {
      if (!visited[pkg.name]) {
        if (hasCycle(pkg.name, [pkg.name])) {
          break;
        }
      }
    }

    expect(
      cycleFound,
      `Circular dependency detected in package graph: ${cycleFound?.join(' -> ')}`
    ).toBeNull();
  });

  it('requires every shared package to expose an explicit public entrypoint', () => {
    for (const workspace of workspaces.filter((item) => item.path.includes('/packages/'))) {
      const packageJson = JSON.parse(readFileSync(join(workspace.path, 'package.json'), 'utf8')) as {
        exports?: Record<string, unknown>;
        types?: string;
        main?: string;
      };
      expect(packageJson.exports, `${workspace.name} must define exports`).toBeDefined();
      expect(packageJson.main, `${workspace.name} must define a runtime entrypoint`).toBeDefined();
      expect(packageJson.types, `${workspace.name} must define a declaration entrypoint`).toBeDefined();
    }
  });

  it('requires each deployable application to have build/start commands and a deployment definition', () => {
    for (const appName of ['api', 'docs', 'web', 'widget', 'worker']) {
      const appPath = join(ROOT_DIR, 'apps', appName);
      const packageJson = JSON.parse(readFileSync(join(appPath, 'package.json'), 'utf8')) as {
        scripts?: Record<string, string>;
      };

      expect(packageJson.scripts?.build, `${appName} is missing a build script`).toBeDefined();
      expect(packageJson.scripts?.start, `${appName} is missing a start script`).toBeDefined();
      expect(statSync(join(appPath, 'Dockerfile')).isFile(), `${appName} is missing a Dockerfile`).toBe(true);
    }
  });
});
