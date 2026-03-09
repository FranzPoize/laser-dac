import { Point } from "../Point";
import { TransformFn } from "./compositor";

export type MaskingBoxesArray = {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}[];

export type MaskingBoxesTransformOptions = {
  masks: MaskingBoxesArray
};

const WAIT_AMOUNT = 24;

function boundValue(min: number, max: number, value: number) {
  return (Math.abs(min-value)<Math.abs(max-value) ? min : max);
}

export function maskingBoxes(options: MaskingBoxesTransformOptions) : TransformFn {
  return (points) => {
    const { masks } = options;
    let blankedPrevious = false;
    return points.reduce<Point[]>((acc, p, i) => {
      let { x, y } = p;
      const { r, g, b } = p;
      // check if point is in mask
      let inMaskBounds = false;
      let cmask = null;
      for (let i=0; i<masks.length; i++) {
        if (x>masks[i].xmin && x<masks[i].xmax && y>masks[i].ymin && y<masks[i].ymax) {
          inMaskBounds = true;
          cmask = masks[i];
          break;
        }
      }
      // skip if already blanked previous and still in mask bounds
      if (inMaskBounds && blankedPrevious)
        return acc;
      // put points back out of mask bounds
      if (inMaskBounds && i > 0) {
        x = points[i-1].x;
        y = points[i-1].y;
      } else if (inMaskBounds && cmask) {
        x = boundValue(cmask.xmin, cmask.xmax, x);
        y = boundValue(cmask.ymin, cmask.ymax, y);
      }
      // add wait before laser goes off
      if (inMaskBounds) {
        for (let index=0; index<8; index++) {
          acc.push({ x, y, r, g, b });
        }
        blankedPrevious = true;
        return acc;
      }
      // add blanking points on new coordinates
      if (blankedPrevious) {
        for (let index=0; index<WAIT_AMOUNT; index++) {
          acc.push({ x, y, r: 0, g: 0, b: 0 });
        }
      }
      acc.push({ x, y, r, g, b });
      blankedPrevious = false;
      return acc;
    }, []);
  };
}


