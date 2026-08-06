# Get the directory where this script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$DataDir = Join-Path $ScriptDir "data"
if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir | Out-Null
    Write-Host "data/ directory created" -ForegroundColor Green
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:8083/")

try {
    $listener.Start()
    Write-Host "Server started: http://127.0.0.1:8083" -ForegroundColor Green
    Start-Process "http://127.0.0.1:8083"
} catch {
    Write-Host "Server already running. Opening browser..." -ForegroundColor Cyan
    Start-Process "http://127.0.0.1:8083"
    exit
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Headers", "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "*")
        $response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
        $response.Headers.Add("Pragma", "no-cache")
        $response.Headers.Add("Expires", "0")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        $urlPath = $request.Url.LocalPath

        # --- API: Load user data ---
        if ($urlPath -eq "/api/load" -and $request.HttpMethod -eq "GET") {
            $userId = $request.QueryString["userId"]
            $responseData = "{}"
            if ($userId -and $userId -match "^[a-zA-Z0-9_-]{1,50}$") {
                $filePath = Join-Path $DataDir ($userId + ".json")
                if (Test-Path $filePath -PathType Leaf) {
                    $responseData = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
                    Write-Host ("[LOAD] " + $userId + ".json loaded") -ForegroundColor Cyan
                } else {
                    Write-Host ("[LOAD] " + $userId + ".json not found on disk") -ForegroundColor Yellow
                }
            }
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($responseData)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        # --- API: Save user data ---
        if ($urlPath -eq "/api/save" -and $request.HttpMethod -eq "POST") {
            $stream = $request.InputStream
            $enc = $request.ContentEncoding
            if (-not $enc) { $enc = [System.Text.Encoding]::UTF8 }
            $reader = New-Object System.IO.StreamReader($stream, $enc)
            $body = $reader.ReadToEnd()
            $reader.Close()
            $ok = $false
            try {
                $data = $body | ConvertFrom-Json
                $userId = $data.userId
                if ($userId -and $userId -match "^[a-zA-Z0-9_-]{1,50}$") {
                    $filePath = Join-Path $DataDir ($userId + ".json")
                    [System.IO.File]::WriteAllText($filePath, $body, [System.Text.Encoding]::UTF8)
                    $itemCnt = if ($data.items) { @($data.items).Count } else { 0 }
                    $recCnt = if ($data.recipes) { @($data.recipes).Count } else { 0 }
                    Write-Host ("[SAVE] " + $userId + ".json saved successfully (items:" + $itemCnt + ", recipes:" + $recCnt + ")") -ForegroundColor Green
                    $ok = $true
                }
            } catch {
                Write-Host ("[SAVE] Error writing file: " + $_) -ForegroundColor Red
            }
            $respBody = if ($ok) { '{"ok":true}' } else { '{"ok":false}' }
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($respBody)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        # --- API: Auth (login / register / change password) ---
        if ($urlPath -eq "/api/auth" -and $request.HttpMethod -eq "POST") {
            $stream = $request.InputStream
            $enc = $request.ContentEncoding
            if (-not $enc) { $enc = [System.Text.Encoding]::UTF8 }
            $reader = New-Object System.IO.StreamReader($stream, $enc)
            $body = $reader.ReadToEnd()
            $reader.Close()
            $resultJson = '{"ok":false}'
            try {
                $cred = $body | ConvertFrom-Json
                $inputId = ("" + $cred.id).Trim()
                $inputPw = ("" + $cred.pw).Trim()
                if ($inputId -and $inputPw) {
                    $usersFile = Join-Path $DataDir "users.json"
                    $users = [PSCustomObject]@{}
                    if (Test-Path $usersFile) {
                        $usersRaw = [System.IO.File]::ReadAllText($usersFile, [System.Text.Encoding]::UTF8)
                        if ($usersRaw -and $usersRaw.Trim().Length -gt 0) {
                            $parsed = $usersRaw | ConvertFrom-Json
                            if ($parsed) { $users = $parsed }
                        }
                    }

                    $existingPw = $null
                    if ($users -and $users.PSObject -and $users.PSObject.Properties) {
                        foreach ($p in $users.PSObject.Properties) {
                            $cleanName = $p.Name.Trim([char]65279)
                            if ($cleanName -ieq $inputId) {
                                $existingPw = $p.Value
                                break
                            }
                        }
                    }

                    if ($cred.changePw -eq $true) {
                        $oldPw = ("" + $cred.oldPw).Trim()
                        if ($existingPw -and ("" + $existingPw) -eq $oldPw) {
                            $users | Add-Member -NotePropertyName $inputId -NotePropertyValue $inputPw -Force
                            $usersJson = $users | ConvertTo-Json
                            [System.IO.File]::WriteAllText($usersFile, $usersJson, [System.Text.Encoding]::UTF8)
                            $resultJson = '{"ok":true}'
                            Write-Host ("[AUTH] " + $inputId + " password changed") -ForegroundColor Yellow
                        } else {
                            $resultJson = '{"ok":false,"msg":"현재 비밀번호가 일치하지 않습니다."}'
                        }
                    } elseif ($existingPw -and ("" + $existingPw) -eq $inputPw) {
                        $resultJson = '{"ok":true}'
                        Write-Host ("[AUTH] " + $inputId + " login OK") -ForegroundColor Green
                    } elseif (-not $existingPw) {
                        $users | Add-Member -NotePropertyName $inputId -NotePropertyValue $inputPw -Force
                        $usersJson = $users | ConvertTo-Json
                        [System.IO.File]::WriteAllText($usersFile, $usersJson, [System.Text.Encoding]::UTF8)
                        $resultJson = '{"ok":true,"isNew":true}'
                        Write-Host ("[AUTH] " + $inputId + " new account created: " + $inputId) -ForegroundColor Yellow
                    } else {
                        $resultJson = '{"ok":false,"msg":"비밀번호가 올바르지 않습니다."}'
                        Write-Host ("[AUTH] " + $inputId + " wrong password") -ForegroundColor Red
                    }
                }
            } catch {
                Write-Host ("[AUTH] Error: " + $_) -ForegroundColor Red
            }
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($resultJson)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        # --- Static file serving ---
        if ($urlPath -eq "/" -or $urlPath -eq "") { $urlPath = "/index.html" }
        $filePath = Join-Path $ScriptDir $urlPath.TrimStart('/')
        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            if ($filePath.EndsWith(".html")) { $response.ContentType = "text/html; charset=utf-8" }
            elseif ($filePath.EndsWith(".js")) { $response.ContentType = "application/javascript; charset=utf-8" }
            elseif ($filePath.EndsWith(".css")) { $response.ContentType = "text/css; charset=utf-8" }
            elseif ($filePath.EndsWith(".json")) { $response.ContentType = "application/json; charset=utf-8" }
            elseif ($filePath.EndsWith(".png")) { $response.ContentType = "image/png" }
            elseif ($filePath.EndsWith(".svg")) { $response.ContentType = "image/svg+xml" }
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($msg, 0, $msg.Length)
        }
        $response.Close()
    } catch {
        Write-Host ("Error: " + $_) -ForegroundColor Red
        if ($response) {
            try { $response.StatusCode = 500; $response.Close() } catch {}
        }
    }
}