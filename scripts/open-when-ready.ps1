param(
  [string]$Url = "http://127.0.0.1:28741/"
)

for ($Attempt = 0; $Attempt -lt 80; $Attempt++) {
  try {
    $Response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 1
    if ($Response.StatusCode -ge 200 -and $Response.StatusCode -lt 500) {
      Start-Process $Url
      exit 0
    }
  } catch {
    Start-Sleep -Milliseconds 250
  }
}
