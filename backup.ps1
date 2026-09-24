# Saves a full copy of the Leave Logs database to backups\leave_logs_<date>.sql
# Run:  powershell -ExecutionPolicy Bypass -File backup.ps1
# Keeps the newest 30 backups and deletes older ones.

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$password = (Get-Content .env | Where-Object { $_ -match '^DB_PASSWORD=' }) -replace '^DB_PASSWORD=', ''
$dir = Join-Path $PSScriptRoot 'backups'
New-Item -ItemType Directory -Force $dir | Out-Null
$file = Join-Path $dir ('leave_logs_' + (Get-Date -Format 'yyyy-MM-dd_HHmm') + '.sql')

# Dump inside the container and copy the file out, so PowerShell never re-encodes the text.
# MYSQL_PWD keeps the password off the command line; --single-transaction gives a consistent copy.
docker exec -e MYSQL_PWD=$password leavelogs-mysql sh -c 'mysqldump -uroot --single-transaction --default-character-set=utf8mb4 --databases leave_logs > /tmp/backup.sql'
if ($LASTEXITCODE -ne 0) { throw 'Backup failed. Is Docker Desktop running?' }
docker cp leavelogs-mysql:/tmp/backup.sql $file | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Backup failed while copying the file out of Docker.' }
docker exec leavelogs-mysql rm /tmp/backup.sql

Get-ChildItem $dir -Filter 'leave_logs_*.sql' | Sort-Object Name -Descending | Select-Object -Skip 30 | Remove-Item
Write-Output ('Backup saved: ' + $file)
