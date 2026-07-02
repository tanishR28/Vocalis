# One-time Vercel production env setup
#
# Run from repo root after creating your HF Space:
#   powershell -ExecutionPolicy Bypass -File deploy/set-vercel-env.ps1 -ApiUrl "https://YOUR-USER-vocalis-api.hf.space"
#
# Requires: Vercel CLI logged in (`npx vercel whoami`)

param(
    [Parameter(Mandatory = $true)]
    [string]$ApiUrl
)

$ErrorActionPreference = "Stop"
$frontendEnv = Join-Path $PSScriptRoot "..\frontend\.env.local"

if (-not (Test-Path $frontendEnv)) {
    Write-Error "Missing frontend/.env.local — copy from frontend/.env.example first."
}

$vars = @{}
Get-Content $frontendEnv | ForEach-Object {
    if ($_ -match '^\s*([A-Z0-9_]+)\s*=\s*(.+)\s*$') {
        $vars[$Matches[1]] = $Matches[2].Trim('"')
    }
}

$required = @('NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
foreach ($key in $required) {
    if (-not $vars.ContainsKey($key)) {
        Write-Error "Missing $key in frontend/.env.local"
    }
}

Push-Location (Join-Path $PSScriptRoot "..\frontend")

function Set-VercelEnv($Name, $Value) {
    Write-Host "Setting $Name (production)..."
    $Value | npx vercel env add $Name production --force 2>&1 | Out-Null
}

Set-VercelEnv 'NEXT_PUBLIC_SUPABASE_URL' $vars['NEXT_PUBLIC_SUPABASE_URL']
Set-VercelEnv 'NEXT_PUBLIC_SUPABASE_ANON_KEY' $vars['NEXT_PUBLIC_SUPABASE_ANON_KEY']
Set-VercelEnv 'NEXT_PUBLIC_REQUIRE_AUTH' 'true'
Set-VercelEnv 'NEXT_PUBLIC_API_URL' $ApiUrl

Write-Host "`nDeploying to production..."
npx vercel deploy --prod --yes

Pop-Location
Write-Host "Done. Add the Vercel URL to Supabase redirect URLs and HF CORS_ORIGINS." -ForegroundColor Green
