import { Resvg } from "@resvg/resvg-js";

export interface RasterizeOptions {
  width?: number;
  height?: number;
}

/**
 * Rasterizes an SVG string to a PNG Buffer on-the-fly.
 * Used for Instagram and Facebook carousels/feed posts that require raster images.
 */
export function rasterizeSvgToPng(svgContent: string, options: RasterizeOptions = {}): Buffer {
  const resvgOptions: any = {};

  if (options.width && options.height) {
    resvgOptions.fitTo = {
      mode: "width",
      value: options.width,
    };
  } else if (options.width) {
    resvgOptions.fitTo = {
      mode: "width",
      value: options.width,
    };
  } else if (options.height) {
    resvgOptions.fitTo = {
      mode: "height",
      value: options.height,
    };
  }

  const resvg = new Resvg(svgContent, resvgOptions);
  const pngData = resvg.render();
  return pngData.asPng();
}
