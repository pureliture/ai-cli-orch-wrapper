#!/usr/bin/env node

const packageRoot = process.env.ACO_BIN_CLEANUP_PACKAGE_ROOT ?? process.cwd();
const prefix = process.env.ACO_BIN_CLEANUP_PREFIX ?? '';
const platform = process.env.ACO_BIN_CLEANUP_PLATFORM ?? process.platform;

console.log(`status=placeholder action=no-op packageRoot=${packageRoot} prefix=${prefix} platform=${platform}`);
