# Generate raster app icons from the same diamond geometry as assets/app-icon.svg.
Add-Type -AssemblyName System.Drawing
$assetDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../assets'))
$background = [System.Drawing.ColorTranslator]::FromHtml('#131816')
$accent = [System.Drawing.ColorTranslator]::FromHtml('#b6f36e')
foreach ($size in @(32, 180, 192, 512)) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $pen = New-Object System.Drawing.Pen($accent, (22 * $size / 512))
    $brush = New-Object System.Drawing.SolidBrush($accent)
    try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.Clear($background)
        $outer = [System.Drawing.PointF[]]@(
            [System.Drawing.PointF]::new($size * .5, $size * .1875),
            [System.Drawing.PointF]::new($size * .8125, $size * .5),
            [System.Drawing.PointF]::new($size * .5, $size * .8125),
            [System.Drawing.PointF]::new($size * .1875, $size * .5)
        )
        $inner = [System.Drawing.PointF[]]@(
            [System.Drawing.PointF]::new($size * .5, $size * .34375),
            [System.Drawing.PointF]::new($size * .65625, $size * .5),
            [System.Drawing.PointF]::new($size * .5, $size * .65625),
            [System.Drawing.PointF]::new($size * .34375, $size * .5)
        )
        $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
        $graphics.DrawPolygon($pen, $outer)
        $graphics.FillPolygon($brush, $inner)
        $bitmap.Save((Join-Path $assetDirectory "app-icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $brush.Dispose(); $pen.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
    }
}
