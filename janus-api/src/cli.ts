#!/usr/bin/env node
import { Command } from 'commander'
import { startServer } from './server'
import * as service from './service'

const SUBCOMMANDS = ['status', 'stop', 'start', 'restart', 'install', 'uninstall', 'run'] as const

function fail(err: unknown): never {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}

const program = new Command()
program.name('janus').description('Janus local API service for janus-webui')

program
  .command('status')
  .description('Show Windows service status')
  .action(() => {
    try {
      service.status()
    } catch (err) {
      fail(err)
    }
  })

program
  .command('stop')
  .description('Stop the Windows service')
  .action(() => {
    try {
      service.stop()
    } catch (err) {
      fail(err)
    }
  })

program
  .command('start')
  .description('Start the Windows service')
  .action(() => {
    try {
      service.start()
    } catch (err) {
      fail(err)
    }
  })

program
  .command('restart')
  .description('Restart the Windows service')
  .action(() => {
    try {
      service.restart()
    } catch (err) {
      fail(err)
    }
  })

program
  .command('install')
  .description('Install the Windows service (requires elevation)')
  .action(() => {
    try {
      service.install()
    } catch (err) {
      fail(err)
    }
  })

program
  .command('uninstall')
  .description('Uninstall the Windows service (requires elevation)')
  .action(() => {
    try {
      service.uninstall()
    } catch (err) {
      fail(err)
    }
  })

program
  .command('run')
  .description('Start the HTTP API server in the foreground')
  .action(async () => {
    try {
      await startServer()
    } catch (err) {
      fail(err)
    }
  })

const args = process.argv.slice(2)
const hasSubcommand = args.some((arg) => (SUBCOMMANDS as readonly string[]).includes(arg))

if (!hasSubcommand) {
  startServer().catch(fail)
} else {
  program.parse(process.argv)
}
