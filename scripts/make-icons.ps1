# Генерирует иконки расширения в public/icon/*.png
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'public\icon'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function New-RoundedPath {
    param([float]$x, [float]$y, [float]$w, [float]$h, [float]$r)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

foreach ($size in 16, 32, 48, 96, 128) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    $radius = [float]($size * 0.22)
    $path = New-RoundedPath 0 0 $size $size $radius
    $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(79, 70, 229),
        [System.Drawing.Color]::FromArgb(139, 92, 246),
        45.0
    )
    $g.FillPath($brush, $path)

    $play = New-Object System.Drawing.Drawing2D.GraphicsPath
    $points = @(
        (New-Object System.Drawing.PointF(($size * 0.38), ($size * 0.28))),
        (New-Object System.Drawing.PointF(($size * 0.38), ($size * 0.72))),
        (New-Object System.Drawing.PointF(($size * 0.74), ($size * 0.50)))
    )
    $play.AddPolygon($points)
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillPath($white, $play)

    $target = Join-Path $outDir "$size.png"
    $bmp.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)

    $white.Dispose()
    $brush.Dispose()
    $path.Dispose()
    $play.Dispose()
    $g.Dispose()
    $bmp.Dispose()
}

Write-Host "Icons written to $outDir"
