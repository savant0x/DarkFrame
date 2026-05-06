# Fix PATH to include system32 for concurrently
$env:PATH = "$env:PATH;C:\Windows\System32"

# Run concurrently with proper PATH
& npx concurrently --kill-others --names "SERVER,STRIPE" --prefix-colors "cyan,magenta" "npm:dev:server" "npm:stripe:listen"
