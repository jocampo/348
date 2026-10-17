# Draws the app icons: four swatches from combination No. 241 on an ink background.
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File tools/make-icons.ps1
param([string]$OutDir = (Join-Path $PSScriptRoot '..\icons'))

Add-Type -AssemblyName System.Drawing

$background = '#1c1a17'
# Red Orange, Pale Lemon Yellow, Dark Medici Blue, Isabella Color (laid out left-to-right, top-to-bottom).
$swatches = '#dd4027', '#ffefae', '#547076', '#c5a56e'

function New-Icon([int]$Size, [double]$Scale, [string]$Name) {
  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml($background))

  $grid = $Size * $Scale
  $gap = $grid * 0.06
  $cell = ($grid - $gap) / 2
  $origin = ($Size - $grid) / 2
  $d = [single]($cell * 0.16)

  for ($i = 0; $i -lt 4; $i++) {
    $x = [single]($origin + ($i % 2) * ($cell + $gap))
    $y = [single]($origin + [math]::Floor($i / 2) * ($cell + $gap))
    $c = [single]$cell
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($x, $y, $d, $d, [single]180, [single]90)
    $path.AddArc($x + $c - $d, $y, $d, $d, [single]270, [single]90)
    $path.AddArc($x + $c - $d, $y + $c - $d, $d, $d, [single]0, [single]90)
    $path.AddArc($x, $y + $c - $d, $d, $d, [single]90, [single]90)
    $path.CloseFigure()
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($swatches[$i]))
    $g.FillPath($brush, $path)
    $brush.Dispose()
    $path.Dispose()
  }

  $g.Dispose()
  $out = Join-Path $OutDir $Name
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "wrote $out"
}

New-Item -ItemType Directory -Force $OutDir | Out-Null
New-Icon 192 0.62 'icon-192.png'
New-Icon 512 0.62 'icon-512.png'
# Maskable icons get cropped to a circle or squircle, so keep the swatches inside the safe zone.
New-Icon 512 0.5 'icon-maskable-512.png'
New-Icon 180 0.62 'apple-touch-icon.png'
New-Icon 32 0.72 'favicon-32.png'
