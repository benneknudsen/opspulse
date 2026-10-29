#!/usr/bin/env node

import { spawn } from "node:child_process";

const children = [];
let shuttingDown = false;

function pipe(stream, target, label) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) target.write(`[${label}] ${line}\n`);
  });
  stream.on("end", () => {
    if (!buffer) return;
    target.write(`[${label}] ${buffer}\n`);
    buffer = "";
  });
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = code;

  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }

  setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  }, 1000).unref();
}

function launch(label, script) {
  const child = spawn("npm", ["run", script], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);

  pipe(child.stdout, process.stdout, label);
  pipe(child.stderr, process.stderr, label);

  child.on("error", (error) => {
    process.stderr.write(`[${label}] ${error.message}\n`);
    shutdown(1);
  });
  child.on("exit", (code, signal) => {
    shutdown(code ?? (signal ? 1 : 0));
  });
}

launch("web", "dev:web");
launch("ws", "dev:ws");

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
