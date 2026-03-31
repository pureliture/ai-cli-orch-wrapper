#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';

const LEGACY_COMMAND = 'wrapper';
const CANONICAL_COMMAND = 'aco';

function resolvePackageRoot() {
  return path.resolve(process.env.ACO_BIN_CLEANUP_PACKAGE_ROOT ?? process.cwd());
}

function resolvePrefix() {
  const envPrefix = process.env.ACO_BIN_CLEANUP_PREFIX?.trim();

  if (envPrefix) {
    return envPrefix;
  }

  const npmProvidedPrefix = process.env.npm_config_prefix?.trim();

  if (npmProvidedPrefix) {
    return npmProvidedPrefix;
  }

  try {
    return execFileSync('npm', ['prefix', '-g'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function readPackageBin(packageRoot) {
  const packageJsonPath = path.join(packageRoot, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

  return packageJson.bin;
}

function resolveBinContract(packageRoot) {
  const bin = readPackageBin(packageRoot);

  if (!bin || typeof bin !== 'object' || Array.isArray(bin)) {
    return null;
  }

  const keys = Object.keys(bin);

  if (keys.length !== 1 || keys[0] !== CANONICAL_COMMAND || typeof bin[CANONICAL_COMMAND] !== 'string') {
    return null;
  }

  return {
    packageCliPath: path.resolve(packageRoot, bin[CANONICAL_COMMAND]),
  };
}

function resolveShimDir(prefix, platform) {
  if (!prefix) {
    return '';
  }

  return platform === 'win32' ? prefix : path.join(prefix, 'bin');
}

function legacyShimCandidates(binDir, platform) {
  if (!binDir) {
    return [];
  }

  if (platform === 'win32') {
    return [
      path.join(binDir, `${LEGACY_COMMAND}.cmd`),
      path.join(binDir, `${LEGACY_COMMAND}.ps1`),
      path.join(binDir, LEGACY_COMMAND),
    ];
  }

  return [path.join(binDir, LEGACY_COMMAND)];
}

function canonicalShimCandidates(binDir, platform) {
  if (!binDir) {
    return [];
  }

  if (platform === 'win32') {
    return [
      path.join(binDir, `${CANONICAL_COMMAND}.cmd`),
      path.join(binDir, `${CANONICAL_COMMAND}.ps1`),
      path.join(binDir, CANONICAL_COMMAND),
    ];
  }

  return [path.join(binDir, CANONICAL_COMMAND)];
}

function firstExistingPath(candidates) {
  return candidates.find(candidate => existsSync(candidate)) ?? null;
}

function realpathIfExists(targetPath) {
  if (!targetPath || !existsSync(targetPath)) {
    return null;
  }

  try {
    return realpathSync(targetPath);
  } catch {
    return null;
  }
}

function main() {
  const packageRoot = resolvePackageRoot();
  const platform = process.env.ACO_BIN_CLEANUP_PLATFORM ?? process.platform;
  const prefix = resolvePrefix();
  const binContract = resolveBinContract(packageRoot);

  if (!binContract) {
    console.log('skipped: package bin contract is not aco-only');
    process.exit(0);
  }

  if (!prefix) {
    console.log('skipped: unable to determine global npm prefix');
    process.exit(0);
  }

  const binDir = resolveShimDir(prefix, platform);
  const wrapperBin = firstExistingPath(legacyShimCandidates(binDir, platform));

  if (!wrapperBin) {
    console.log(`found nothing: no legacy ${LEGACY_COMMAND} shim at ${binDir}`);
    process.exit(0);
  }

  const wrapperTarget = realpathIfExists(wrapperBin);
  const packageCliTarget = realpathIfExists(binContract.packageCliPath);
  const acoBin = firstExistingPath(canonicalShimCandidates(binDir, platform));
  const acoTarget = realpathIfExists(acoBin);
  const ownsWrapperShim = Boolean(
    wrapperTarget &&
    ((packageCliTarget && wrapperTarget === packageCliTarget) || (acoTarget && wrapperTarget === acoTarget)),
  );

  if (!ownsWrapperShim) {
    console.log(`skipped: legacy ${LEGACY_COMMAND} shim at ${wrapperBin} is not owned by this package`);
    process.exit(0);
  }

  rmSync(wrapperBin);
  console.log(`removed: stale package-owned ${LEGACY_COMMAND} shim at ${wrapperBin}`);
}

main();
