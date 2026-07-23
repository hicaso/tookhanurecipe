# Get the directory where this script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:8083/")

try {
    $listener.Start()
    Write-Host "Recipe Cost Calculator Server started on http://127.0.0.1:8083"
    Start-Process "http://127.0.0.1:8083"
} catch {
    Write-Host "`n[정보] 이미 8083 포트에서 레시피 계산기 서버가 실행 중입니다." -ForegroundColor Cyan
    Write-Host "브라우저로 열기를 시도합니다... http://127.0.0.1:8083`n" -ForegroundColor Cyan
    Start-Process "http://127.0.0.1:8083"
    exit
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        # Add CORS Headers
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Headers", "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "*")
        
        # Handle Preflight OPTIONS Request
        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }
        
        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/" -or $urlPath -eq "") {
            $urlPath = "/index.html"
        }
        
        $filePath = Join-Path $ScriptDir $urlPath.TrimStart('/')
        
        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            
            # Content Type Mapping
            if ($filePath.EndsWith(".html")) {
                $response.ContentType = "text/html; charset=utf-8"
            } elseif ($filePath.EndsWith(".js")) {
                $response.ContentType = "application/javascript; charset=utf-8"
            } elseif ($filePath.EndsWith(".css")) {
                $response.ContentType = "text/css; charset=utf-8"
            } elseif ($filePath.EndsWith(".png")) {
                $response.ContentType = "image/png"
            } elseif ($filePath.EndsWith(".svg")) {
                $response.ContentType = "image/svg+xml"
            }
            
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($msg, 0, $msg.Length)
        }
        $response.Close()
    } catch {
        Write-Host "Error: $_" -ForegroundColor Red
        if ($response) {
            try {
                $response.StatusCode = 500
                $response.Close()
            } catch {}
        }
    }
}
