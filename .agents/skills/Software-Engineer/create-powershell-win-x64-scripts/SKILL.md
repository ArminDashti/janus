---
name: create-powershell-win-x64-scripts
description: >-
  Generates styled Windows x64 PowerShell installer, uninstaller, and test scripts placed in a specific project directory, handling build processes and admin-level hosts file modifications.
disable-model-invocation: false
metadata:
  version: 1.0.5
  author: "Armin Dashti"
  tags: [powershell, windows-x64, automation, testing, hosts-file, build]
  last_updated: "2026-09-26 06:57:00"
  uuid: 61494fac-bed4-42c8-b05e-2a09a44277d5
---
Analyze the codebase to determine if `<App Name>` runs as a Windows Service or standard executable, and identify the correct build tools/commands (e.g., `go build`, `dotnet publish`, `cargo build`). Generate exactly three token-efficient PowerShell scripts and specify their filepaths as `./<PROJECT Name>/scripts/<script-name>.ps1`.

Rules for all scripts:
- Use informative, color-coded console output (`Write-Host -ForegroundColor`: Green=Success, Yellow=Info, Red=Error).
- Output only code blocks with their respective filepaths as headers. No conversational filler.

### 1. ./<PROJECT Name>/scripts/installer-win-x64.ps1 (Install & Update)
- **Build First:** Determine the appropriate build command based on codebase analysis and execute it to compile and create the `.exe` before proceeding. Ensure the script checks for a successful build and fails gracefully if compilation fails.
- Gracefully stop the running app/service based on codebase analysis.
- Base path: `$env:LOCALAPPDATA\<App Name>`. Create empty `Settings.json` and `Data.db` if they do not exist.
- Remove old `.exe` (if present) and copy the newly built `.exe` to the base path.
- Add base path to User `PATH` environment variable if absent.
- ONLY include `--port` and `--dir` parameter logic if explicitly requested in the prompt.
- **Hosts File Modification:** Add a `--local-address=<>` parameter. If provided (e.g., `example.local`), safely append it (mapping to `127.0.0.1`) to the Windows `hosts` file. 
- **Admin Permissions:** Carefully handle Administrator privileges for `hosts` file modification. Check for elevation; if not elevated, automatically attempt to restart the script as Admin, or fail gracefully with a clear error.

### 2. ./<PROJECT Name>/scripts/Remove-win-x64.ps1
- Gracefully stop the app/service.
- Forcefully delete the base path and all contents completely.
- Cleanly remove the base path from the User `PATH` environment variable.
- Clean up any associated `--local-address` entries from the `hosts` file, ensuring Admin privileges are checked and handled appropriately.

### 3. ./<PROJECT Name>/scripts/test-win-x64.ps1 (Lifecycle Testing)
- Automate and validate the full lifecycle: Test Build/Create `.exe`, test Install (including `--local-address` if requested), test Update (re-run installer), and test Remove.
- Verify file presence/absence, `PATH` modifications, and `hosts` file changes at each step, outputting colored assertions to guarantee operations succeed.