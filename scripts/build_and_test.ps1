param(
    [string]$ImageName = 'ikai-backend:local',
    [string]$DockerfilePath = 'docker/backend/Dockerfile',
    [int]$Port = 8000,
    [int]$WaitSeconds = 30
)

Write-Host "Building Docker image '$ImageName' from '$DockerfilePath'..."
docker build -t $ImageName -f $DockerfilePath .
if ($LASTEXITCODE -ne 0) { Write-Error 'Docker build failed'; exit 1 }

Write-Host 'Starting container (detached)...'
docker run --rm -d --name ikai-local -p $Port:8000 -e LOG_FILE=/tmp/ikai_app.log $ImageName | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Error 'Docker run failed'; exit 1 }

Write-Host "Waiting up to $WaitSeconds seconds for health endpoint http://127.0.0.1:$Port/health..."
$healthy = $false
for ($i=0; $i -lt $WaitSeconds; $i++) {
    try {
        $resp = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2
        if ($resp -and $resp.status -eq 'ok') { $healthy = $true; break }
    } catch { }
    Start-Sleep -Seconds 1
}

if ($healthy) {
    Write-Host 'Health check passed — backend is up.' -ForegroundColor Green
    Write-Host 'Tailing container logs (Ctrl+C to stop):'
    docker logs -f ikai-local
} else {
    Write-Error "Health check failed after $WaitSeconds seconds. See container logs:"
    docker logs --tail 100 ikai-local
    Write-Host 'You can stop the container with: docker stop ikai-local'
    exit 2
}
