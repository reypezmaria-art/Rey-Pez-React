param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-f0-9]{40}$')]
    [string]$Version,
    [string]$Proyecto = (Get-Location).Path,
    [ValidatePattern('^[A-Za-z0-9._-]*$')]
    [string]$CuentaNomina = ''
)
$ErrorActionPreference = 'Stop'
$ubicacionAnterior = Get-Location
try {
    Set-Location -LiteralPath $Proyecto
    if (!(Test-Path -LiteralPath '.env.local') -or !(Test-Path -LiteralPath 'package.json')) {
        throw 'Abre PowerShell en la carpeta de Rey Pez que contiene .env.local y package.json.'
    }
    if ((Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json).name -ne 'rey-pez-admin') {
        throw 'La carpeta seleccionada no corresponde al proyecto Rey Pez.'
    }
    $temporalNomina = Join-Path ([IO.Path]::GetTempPath()) ('ReyPez-Nomina-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $temporalNomina | Out-Null
    $zipNomina = Join-Path $temporalNomina 'codigo.zip'
    Invoke-WebRequest -Uri "https://github.com/reypezmaria-art/Rey-Pez-React/archive/$Version.zip" -OutFile $zipNomina
    $extraidoNomina = Join-Path $temporalNomina 'fuente'
    Expand-Archive -LiteralPath $zipNomina -DestinationPath $extraidoNomina
    $fuenteNomina = (Get-ChildItem -LiteralPath $extraidoNomina -Directory | Select-Object -First 1).FullName
    if (!$fuenteNomina -or !(Test-Path (Join-Path $fuenteNomina 'codigo/paginas/Nomina.jsx'))) {
        throw 'La descarga no contiene la version esperada de Nomina.'
    }
    $respaldoNomina = Join-Path $temporalNomina 'codigo-anterior'
    foreach ($archivoNomina in (Get-ChildItem -LiteralPath $fuenteNomina -File -Recurse -Force)) {
        $relativoNomina = $archivoNomina.FullName.Substring($fuenteNomina.Length + 1)
        if ($relativoNomina -match '(^|[\\/])\.env($|\.)' -and $relativoNomina -ne '.env.ejemplo') {
            continue
        }
        $destinoNomina = Join-Path $Proyecto $relativoNomina
        if (Test-Path -LiteralPath $destinoNomina -PathType Leaf) {
            $copiaNomina = Join-Path $respaldoNomina $relativoNomina
            New-Item -ItemType Directory -Path (Split-Path $copiaNomina -Parent) -Force | Out-Null
            Copy-Item -LiteralPath $destinoNomina -Destination $copiaNomina -Force
        }
        New-Item -ItemType Directory -Path (Split-Path $destinoNomina -Parent) -Force | Out-Null
        Copy-Item -LiteralPath $archivoNomina.FullName -Destination $destinoNomina -Force
    }
    Write-Host "Codigo anterior conservado en: $respaldoNomina"
    if ($CuentaNomina) {
        $rutaEnvNomina = Join-Path $Proyecto '.env.local'
        $envNomina = [IO.File]::ReadAllText($rutaEnvNomina)
        $envNomina = [regex]::Replace($envNomina, '(?m)^VITE_NOMINA_CONSULTA_INICIAL=.*\r?\n?', '')
        $envNomina = $envNomina.TrimEnd() + "`nVITE_NOMINA_CONSULTA_INICIAL=" + $CuentaNomina.ToUpperInvariant() + "`n"
        [IO.File]::WriteAllText($rutaEnvNomina, $envNomina, (New-Object Text.UTF8Encoding($false)))
    }
    npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'No se completaron las dependencias. No se publico el sitio.' }
    node --input-type=module -e "import {loadEnv} from 'vite'; const e=loadEnv('production',process.cwd()); for(const k of ['VITE_FIREBASE_API_KEY','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_APP_ID','VITE_ACCESO_API_URL']) if(!e[k]) throw Error('Falta '+k); if(e.VITE_FIREBASE_PROJECT_ID!=='rey-pez-admin-react') throw Error('Proyecto Firebase incorrecto'); console.log('Configuracion completa');"
    if ($LASTEXITCODE -ne 0) { throw 'Revisa la configuracion. No se publico el sitio.' }
    npm.cmd run verificar
    if ($LASTEXITCODE -ne 0) { throw 'Fallo la verificacion. No se publico el sitio.' }
    npx.cmd -y firebase-tools@latest deploy --project rey-pez-admin-react --only 'firestore:rules,hosting'
    if ($LASTEXITCODE -ne 0) { throw 'No se completo la publicacion. Comparte el mensaje de error.' }
    Write-Host 'Nomina publicada. Abre https://rey-pez-admin-react.web.app/ y actualiza con Ctrl+F5.'
} finally {
    Set-Location $ubicacionAnterior
}
