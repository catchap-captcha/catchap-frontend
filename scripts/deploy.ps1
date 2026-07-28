<#
.SYNOPSIS
  프론트 VM(www.catchap5.com)으로 수동 배포 — 로컬 소스를 올려 VM에서 도커 재빌드.

.DESCRIPTION
  흐름: (1) 로컬 커밋·푸시(origin/jy) → (2) 빌드 컨텍스트를 tar로 묶어 scp 업로드
        → (3) VM에서 압축 해제 후 docker compose up -d --build → (4) HTTPS 응답 확인.

  자동 배포(CI)는 쓰지 않는다. 이 스크립트를 직접 실행할 때만 배포된다.

  VM의 .env(실제 edu 사이트 키가 들어있음)는 업로드 대상에서 제외하므로 덮어쓰지 않는다.
  VITE_* 값은 Vite가 빌드 타임에 번들로 인라인하므로 항상 --build 로 재빌드한다.

.EXAMPLE
  .\scripts\deploy.ps1 -Message "fix: 로그인 화면 여백"
  .\scripts\deploy.ps1 -SkipPush          # 이미 푸시한 상태에서 재배포만
#>
[CmdletBinding()]
param(
  # 커밋 메시지. 워킹트리가 더러운데 이 값이 없으면 중단한다.
  [string]$Message,

  # 이미 커밋·푸시가 끝난 경우 git 단계를 건너뛴다.
  [switch]$SkipPush,

  # SSH 개인키 경로 — 사람마다 다르므로 환경변수 CATCHAP_DEPLOY_KEY 로 두거나 -KeyPath 로 준다.
  [string]$KeyPath  = $(if ($env:CATCHAP_DEPLOY_KEY) { $env:CATCHAP_DEPLOY_KEY } else { "$env:USERPROFILE\.ssh\catchap_aws" }),
  [string]$User     = "ubuntu",
  [string]$VmHost   = "210.109.14.25",

  # VM 안의 프로젝트 경로(공백 없는 경로 기준). 원격 셸이 $HOME 을 확장한다.
  [string]$RemoteDir = '$HOME/catchap-frontend',

  [string]$Branch   = "jy",

  # 재빌드로 쌓인 dangling 이미지 정리(기본 끔).
  [switch]$Prune
)

$ErrorActionPreference = 'Stop'

function Fail($msg) { Write-Host "[배포 중단] $msg" -ForegroundColor Red; exit 1 }
function Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if (-not (Test-Path $KeyPath)) { Fail "키 파일이 없습니다: $KeyPath" }
if (-not (Test-Path (Join-Path $RepoRoot 'Dockerfile'))) { Fail "$RepoRoot 에 Dockerfile이 없습니다. 프론트 저장소가 맞는지 확인하세요." }

$SshArgs = @('-i', $KeyPath, '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=15')
$Target  = "$User@$VmHost"

# ---------------------------------------------------------------- 1) git
if (-not $SkipPush) {
  Step "1/4 커밋 · 푸시 (origin/$Branch)"

  $current = (git rev-parse --abbrev-ref HEAD).Trim()
  if ($current -ne $Branch) { Fail "현재 브랜치가 '$current' 입니다. '$Branch' 에서 실행하세요 (git switch $Branch)." }

  $dirty = git status --porcelain
  if ($dirty) {
    if (-not $Message) { Fail "커밋되지 않은 변경이 있습니다. -Message '커밋 메시지' 를 주거나 직접 커밋하세요." }
    git add -A
    if ($LASTEXITCODE -ne 0) { Fail "git add 실패" }
    git commit -m $Message
    if ($LASTEXITCODE -ne 0) { Fail "git commit 실패" }
  } else {
    Write-Host "변경 없음 — 커밋 건너뜀"
  }

  git push origin $Branch
  if ($LASTEXITCODE -ne 0) { Fail "git push 실패" }
} else {
  Step "1/4 git 단계 건너뜀 (-SkipPush)"
}

$Commit = (git rev-parse --short HEAD).Trim()

# ------------------------------------------------- 2) 빌드 컨텍스트 업로드
Step "2/4 빌드 컨텍스트 업로드"

# VM의 .env 는 제외 — 실제 edu 키가 들어있어 덮어쓰면 위젯 인증이 깨진다.
$TarName  = "catchap-frontend-$Commit.tgz"
$TarLocal = Join-Path $env:TEMP $TarName
if (Test-Path $TarLocal) { Remove-Item $TarLocal -Force }

tar -czf $TarLocal `
  --exclude=./node_modules --exclude=./node_modules/* `
  --exclude=./dist --exclude=./dist/* `
  --exclude=./.git --exclude=./.git/* `
  --exclude=./.env --exclude=./.env.* `
  -C $RepoRoot .
if ($LASTEXITCODE -ne 0) { Fail "tar 압축 실패" }
$sizeMb = [math]::Round((Get-Item $TarLocal).Length / 1MB, 1)
Write-Host "묶음 생성: $TarName ($sizeMb MB, commit $Commit)"

# 원격에 .env 가 있는지 먼저 확인 — 없으면 빌드 인자가 비어 잘못된 번들이 만들어진다.
$check = ssh @SshArgs $Target ("test -f {0}/.env && echo ENV_OK || echo ENV_MISSING" -f $RemoteDir)
if ($LASTEXITCODE -ne 0) { Fail "SSH 접속 실패 — 키/계정/호스트를 확인하세요 ($Target)" }
if ($check -notmatch 'ENV_OK') { Fail "$RemoteDir/.env 가 VM에 없습니다. .env.production.example 을 복사해 edu 키를 채운 뒤 다시 실행하세요." }

scp @SshArgs $TarLocal "${Target}:/tmp/$TarName"
if ($LASTEXITCODE -ne 0) { Fail "scp 업로드 실패" }

# ------------------------------------------------------- 3) VM에서 재빌드
Step "3/4 VM에서 재빌드 (docker compose up -d --build)"

$pruneCmd = if ($Prune) { 'docker image prune -f' } else { 'true' }

# 원격 명령은 한 줄로 — PowerShell이 네이티브 exe에 넘길 때 줄바꿈 인용이 깨지지 않게.
$remote = 'set -e; cd __REMOTE_DIR__; tar -xzf /tmp/__TAR_NAME__ -C .; rm -f /tmp/__TAR_NAME__; docker compose --env-file .env up -d --build; __PRUNE__; docker compose ps'
$remote = $remote.Replace('__REMOTE_DIR__', $RemoteDir).Replace('__TAR_NAME__', $TarName).Replace('__PRUNE__', $pruneCmd)

ssh @SshArgs $Target $remote
if ($LASTEXITCODE -ne 0) { Fail "VM 재빌드 실패 — 위 로그를 확인하세요." }

Remove-Item $TarLocal -Force -ErrorAction SilentlyContinue

# --------------------------------------------------------------- 4) 확인
Step "4/4 배포 확인"
try {
  $res = Invoke-WebRequest -Uri "https://www.catchap5.com" -UseBasicParsing -TimeoutSec 20
  Write-Host "https://www.catchap5.com → HTTP $($res.StatusCode)" -ForegroundColor Green
} catch {
  Write-Host "확인 요청 실패: $($_.Exception.Message)" -ForegroundColor Yellow
  Write-Host "컨테이너는 떴을 수 있습니다. 브라우저에서 직접 확인하세요." -ForegroundColor Yellow
}

Write-Host "`n배포 완료 (commit $Commit)" -ForegroundColor Green
Write-Host "브라우저 캐시 때문에 안 바뀐 것처럼 보이면 Ctrl+Shift+R 로 강력 새로고침하세요."
