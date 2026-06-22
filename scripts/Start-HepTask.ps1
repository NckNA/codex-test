# Start-HepTask.ps1
# Wrapper script to execute the Hermes Execution Platform (HEP) Task Runner CLI.
# Usage: .\scripts\Start-HepTask.ps1 <command> [options]

node "$PSScriptRoot/../tools/hep/index.ts" $args
