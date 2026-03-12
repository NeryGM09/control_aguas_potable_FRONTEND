param(
  [ValidateSet("release", "debug")]
  [string]$Variant = "release",
  [string]$OutDir = "dist_apk",
  [switch]$SkipNpm
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if (-not $SkipNpm) {
  npm run android:build
  if ($LASTEXITCODE -ne 0) {
    throw "npm run android:build failed."
  }
}

$apkDir = Join-Path $root "android/app/build/outputs/apk"
if (Test-Path $apkDir) {
  Remove-Item $apkDir -Recurse -Force
}

$gradle = Join-Path $root "android/gradlew.bat"
if (-not (Test-Path $gradle)) {
  throw "gradlew.bat not found."
}

Push-Location (Join-Path $root "android")
$taskName = "assemble" + $Variant.Substring(0, 1).ToUpper() + $Variant.Substring(1)
& $gradle $taskName
if ($LASTEXITCODE -ne 0) {
  Pop-Location
  throw "Gradle build failed."
}
Pop-Location

$variantDir = Join-Path $apkDir $Variant
$apk = Get-ChildItem -Path $variantDir -Filter "*.apk" -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if (-not $apk) {
  throw "APK not found in $variantDir"
}

$outPath = Join-Path $root $OutDir
if (-not (Test-Path $outPath)) {
  New-Item -ItemType Directory -Path $outPath | Out-Null
}

$destName = "control_aguas_$Variant.apk"
$dest = Join-Path $outPath $destName
Copy-Item $apk.FullName $dest -Force

Write-Host "APK generado: $dest"
