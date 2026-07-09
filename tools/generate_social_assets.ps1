Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$outDir = Join-Path $root 'assets\social'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$pink = [System.Drawing.Color]::FromArgb(236, 79, 136)
$pinkDeep = [System.Drawing.Color]::FromArgb(214, 44, 112)
$cyan = [System.Drawing.Color]::FromArgb(86, 209, 225)
$yellow = [System.Drawing.Color]::FromArgb(255, 226, 105)
$black = [System.Drawing.Color]::FromArgb(24, 24, 24)
$white = [System.Drawing.Color]::White
$cream = [System.Drawing.Color]::FromArgb(255, 248, 240)

$privateFonts = New-Object System.Drawing.Text.PrivateFontCollection
$huiFontPath = Join-Path $root 'assets\fonts\HuiFontP29.ttf'
if (Test-Path -LiteralPath $huiFontPath) {
  $privateFonts.AddFontFile($huiFontPath)
}
$huiFamily = if ($privateFonts.Families.Count -gt 0) { $privateFonts.Families[0] } else { New-Object System.Drawing.FontFamily 'Meiryo' }
$gothicFamily = New-Object System.Drawing.FontFamily 'Meiryo'

function New-Font($family, [float]$size, [System.Drawing.FontStyle]$style = [System.Drawing.FontStyle]::Bold) {
  return [System.Drawing.Font]::new($family, $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
}

function Draw-RoundedRect($g, $brush, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $g.FillPath($brush, $path)
  $path.Dispose()
}

function Stroke-RoundedRect($g, $pen, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $g.DrawPath($pen, $path)
  $path.Dispose()
}

function Draw-Centered($g, [string]$text, $font, $brush, [float]$x, [float]$y, [float]$w, [float]$h) {
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = [System.Drawing.StringAlignment]::Center
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = [System.Drawing.RectangleF]::new($x, $y, $w, $h)
  $g.DrawString($text, $font, $brush, $rect, $fmt)
  $fmt.Dispose()
}

function Draw-TextWithStroke($g, [string]$text, $font, $fillBrush, $strokePen, [float]$x, [float]$y, [float]$w, [float]$h) {
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = [System.Drawing.StringAlignment]::Center
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $em = $font.Size
  $rect = [System.Drawing.RectangleF]::new($x, $y, $w, $h)
  $path.AddString($text, $font.FontFamily, [int]$font.Style, $em, $rect, $fmt)
  $g.DrawPath($strokePen, $path)
  $g.FillPath($fillBrush, $path)
  $path.Dispose()
  $fmt.Dispose()
}

function Draw-CardStack($g, [float]$x, [float]$y, [float]$scale) {
  $pen = [System.Drawing.Pen]::new($white, [int](5 * $scale))
  $linePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(185, 228, 238), [int](4 * $scale))
  $dotBrushes = @(
    [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(99, 184, 92)),
    [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(50, 120, 190)),
    [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(244, 203, 50)),
    [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(203, 40, 52)),
    [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(239, 130, 38))
  )
  $angles = @(-8, 5, 12)
  for ($i = 0; $i -lt 3; $i++) {
    $state = $g.Save()
    $g.TranslateTransform($x + $i * 96 * $scale, $y + $i * 10 * $scale)
    $g.RotateTransform($angles[$i])
    $cardW = 260 * $scale
    $cardH = 330 * $scale
    $brush = [System.Drawing.SolidBrush]::new($white)
    Draw-RoundedRect $g $brush 0 0 $cardW $cardH (16 * $scale)
    $g.DrawRectangle($pen, 0, 0, $cardW, $cardH)
    for ($l = 0; $l -lt 8; $l++) {
      $yy = (56 + $l * 34) * $scale
      $g.DrawLine($linePen, 20 * $scale, $yy, ($cardW - 18 * $scale), $yy)
    }
    for ($d = 0; $d -lt 5; $d++) {
      $g.FillEllipse($dotBrushes[$d], 38 * $scale, (82 + $d * 42) * $scale, 20 * $scale, 20 * $scale)
    }
    $g.Restore($state)
    $brush.Dispose()
  }
  $pen.Dispose()
  $linePen.Dispose()
  $dotBrushes | ForEach-Object { $_.Dispose() }
}

function Draw-Common($g, [int]$w, [int]$h) {
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $bg = [System.Drawing.SolidBrush]::new($pink)
  $g.FillRectangle($bg, 0, 0, $w, $h)
  $heartBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(55, 255, 255, 255))
  $heartFont = New-Font $gothicFamily 28
  foreach ($p in @(@(90,120), @(930,180), @(160,1040), @(880,960), @(520,250))) {
    $g.DrawString('♡', $heartFont, $heartBrush, $p[0], $p[1])
  }
  $bg.Dispose()
  $heartBrush.Dispose()
  $heartFont.Dispose()
}

function Draw-Footer($g, [int]$w, [int]$h, [string]$sub = '無料・登録なし・スマホ1台') {
  $blackBrush = [System.Drawing.SolidBrush]::new($black)
  $yellowBrush = [System.Drawing.SolidBrush]::new($yellow)
  $whiteBrush = [System.Drawing.SolidBrush]::new($white)
  $fontSmall = New-Font $gothicFamily 30
  $fontUrl = New-Font $gothicFamily 42
  Draw-RoundedRect $g $blackBrush 80 ($h - 205) ($w - 160) 128 30
  Draw-Centered $g $sub $fontSmall $whiteBrush 90 ($h - 190) ($w - 180) 40
  Draw-Centered $g 'streetboardgame.com' $fontUrl $yellowBrush 90 ($h - 142) ($w - 180) 58
  $blackBrush.Dispose(); $yellowBrush.Dispose(); $whiteBrush.Dispose(); $fontSmall.Dispose(); $fontUrl.Dispose()
}

function Draw-Girl($g, [float]$x, [float]$y, [float]$h) {
  $path = Join-Path $root 'assets\character\girl-full.png'
  $img = [System.Drawing.Image]::FromFile($path)
  $ratio = $img.Width / $img.Height
  $w = $h * $ratio
  $g.DrawImage($img, $x, $y, $w, $h)
  $img.Dispose()
}

function Save-Image([int]$w, [int]$h, [string]$fileName, [scriptblock]$draw) {
  $bmp = [System.Drawing.Bitmap]::new($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  Draw-Common $g $w $h
  & $draw $g $w $h
  $path = Join-Path $outDir $fileName
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  return $path
}

$whiteBrush = [System.Drawing.SolidBrush]::new($white)
$blackBrush = [System.Drawing.SolidBrush]::new($black)
$yellowBrush = [System.Drawing.SolidBrush]::new($yellow)
$pinkBrush = [System.Drawing.SolidBrush]::new($pinkDeep)
$cyanPen = [System.Drawing.Pen]::new($cyan, 12)
$blackPen = [System.Drawing.Pen]::new($black, 10)
$whitePen = [System.Drawing.Pen]::new($white, 12)

$created = @()
$created += Save-Image 1080 1350 'watachan-instagram-feed.png' {
  param($g, $w, $h)
  $titleFont = New-Font $huiFamily 96
  $subFont = New-Font $gothicFamily 40
  Draw-TextWithStroke $g '彼氏、私のこと' $titleFont $whiteBrush $cyanPen 70 90 940 120
  Draw-TextWithStroke $g '何問当てられる？' $titleFont $whiteBrush $cyanPen 70 205 940 120
  Draw-Girl $g 110 410 520
  Draw-CardStack $g 445 470 1.08
  Draw-RoundedRect $g $yellowBrush 112 990 856 96 30
  Stroke-RoundedRect $g $blackPen 112 990 856 96 30
  Draw-Centered $g '5問でわかる 彼氏の彼女理解度' $subFont $blackBrush 130 1006 820 60
  Draw-Footer $g $w $h
  $titleFont.Dispose(); $subFont.Dispose()
}

$created += Save-Image 1080 1920 'watachan-reel-cover.png' {
  param($g, $w, $h)
  $titleFont = New-Font $huiFamily 106
  $subFont = New-Font $gothicFamily 44
  Draw-TextWithStroke $g '5問でわかる' $titleFont $whiteBrush $cyanPen 70 170 940 130
  Draw-TextWithStroke $g '彼氏の彼女理解度' $titleFont $whiteBrush $cyanPen 56 305 968 140
  Draw-CardStack $g 360 560 1.2
  Draw-Girl $g 130 690 690
  Draw-RoundedRect $g $yellowBrush 110 1400 860 104 32
  Stroke-RoundedRect $g $blackPen 110 1400 860 104 32
  Draw-Centered $g 'デート中・飲み会・旅行にも' $subFont $blackBrush 130 1420 820 60
  Draw-Footer $g $w $h '無料・登録なし・スマホ1台で遊べる'
  $titleFont.Dispose(); $subFont.Dispose()
}

$created += Save-Image 1080 1920 'watachan-story.png' {
  param($g, $w, $h)
  $titleFont = New-Font $huiFamily 96
  $subFont = New-Font $gothicFamily 42
  Draw-TextWithStroke $g '無料で遊べる' $titleFont $whiteBrush $cyanPen 70 150 940 120
  Draw-TextWithStroke $g 'カップル診断' $titleFont $whiteBrush $cyanPen 70 270 940 120
  Draw-Girl $g 135 520 720
  Draw-CardStack $g 390 600 1.16
  Draw-RoundedRect $g $blackBrush 100 1320 880 156 34
  Draw-Centered $g 'プロフィールのリンクから' $subFont $whiteBrush 120 1340 840 58
  Draw-Centered $g '今すぐ無料で遊べます' $subFont $yellowBrush 120 1402 840 58
  Draw-Footer $g $w $h '彼氏の愛情判定ゲーム'
  $titleFont.Dispose(); $subFont.Dispose()
}

$created += Save-Image 1200 675 'watachan-sns-wide.png' {
  param($g, $w, $h)
  $titleFont = New-Font $huiFamily 72
  $subFont = New-Font $gothicFamily 34
  Draw-TextWithStroke $g '彼氏、私のこと' $titleFont $whiteBrush $cyanPen 50 58 620 86
  Draw-TextWithStroke $g '何問当てられる？' $titleFont $whiteBrush $cyanPen 50 142 620 86
  Draw-Girl $g 85 280 330
  Draw-CardStack $g 480 240 0.82
  Draw-RoundedRect $g $blackBrush 700 88 420 112 30
  Draw-Centered $g '無料・登録なし' $subFont $whiteBrush 720 100 380 38
  Draw-Centered $g 'スマホ1台で遊べる' $subFont $yellowBrush 720 142 380 42
  $urlFont = New-Font $gothicFamily 30
  Draw-RoundedRect $g $yellowBrush 650 472 500 82 24
  Stroke-RoundedRect $g $blackPen 650 472 500 82 24
  Draw-Centered $g 'streetboardgame.com' $urlFont $blackBrush 666 488 468 44
  $urlFont.Dispose()
  $titleFont.Dispose(); $subFont.Dispose()
}

$whiteBrush.Dispose(); $blackBrush.Dispose(); $yellowBrush.Dispose(); $pinkBrush.Dispose()
$cyanPen.Dispose(); $blackPen.Dispose(); $whitePen.Dispose()
$privateFonts.Dispose()

$created | ForEach-Object { Get-Item -LiteralPath $_ | Select-Object FullName, Length, LastWriteTime }
