# Inicia todo el sistema: backend (FastAPI, puerto 8000) + frontend (Vite, puerto 5173).
# Uso, desde la raíz del proyecto:   .\iniciar.ps1        (o doble clic en iniciar.bat)
# La primera vez crea el entorno de Python e instala las dependencias; después arranca en segundos.
# Para detener todo: Ctrl+C en esta ventana.

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$venvPy = Join-Path $backend '.venv\Scripts\python.exe'

Write-Host "`n=== La Maquina de Turing ===`n" -ForegroundColor Yellow

# --- Backend: entorno virtual y dependencias ---
if (-not (Test-Path $venvPy)) {
    Write-Host 'Creando el entorno de Python (solo la primera vez)...'
    $py = if (Get-Command py -ErrorAction SilentlyContinue) { 'py' } else { 'python' }
    & $py -m venv (Join-Path $backend '.venv')
}
Write-Host 'Revisando dependencias del backend...'
& $venvPy -m pip install --quiet --disable-pip-version-check -r (Join-Path $backend 'requirements.txt')

# --- Frontend: dependencias ---
if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
    Write-Host 'Instalando dependencias del frontend (solo la primera vez)...'
    npm --prefix $frontend install
}

# --- Arrancar el backend en segundo plano ---
Write-Host 'Encendiendo el backend en http://127.0.0.1:8000 ...' -ForegroundColor Green
$env:PYTHONPATH = $backend
$api = Start-Process -FilePath $venvPy -ArgumentList '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000' `
    -WorkingDirectory $backend -NoNewWindow -PassThru

try {
    # Espera a que el backend responda (máximo ~20 s)
    $ready = $false
    for ($i = 0; $i -lt 40 -and -not $ready; $i++) {
        # 127.0.0.1 y no localhost: en Windows localhost puede ir primero por IPv6 y no encontrar al backend
        try { Invoke-RestMethod -Uri 'http://127.0.0.1:8000/' -TimeoutSec 2 | Out-Null; $ready = $true }
        catch { Start-Sleep -Milliseconds 500 }
    }
    if (-not $ready) { throw 'El backend no arranco. Revisa los mensajes de arriba.' }

    # --- Frontend con el backend real (ignora el modo simulado de .env.development.local) ---
    Write-Host 'Encendiendo el frontend; se abrira el navegador...' -ForegroundColor Green
    $env:VITE_USE_MOCK = 'false'
    npm --prefix $frontend run dev -- --open
}
finally {
    Write-Host "`nApagando el backend..." -ForegroundColor Yellow
    if ($api -and -not $api.HasExited) { Stop-Process -Id $api.Id -Force }
}
