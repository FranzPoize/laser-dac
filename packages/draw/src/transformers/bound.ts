import {TransformFn} from "./compositor";
import {Point} from "../Point";

interface BoundTransformerOptions {
  xmin?: number;
  xmax?: number;
  ymin?: number;
  ymax?: number;
}

const WAIT_AMOUNT = 24;

export function bound(options: BoundTransformerOptions) : TransformFn  {
  const xmin = options.xmin || 0.0;
  const xmax = options.xmax || 1.0;
  const ymin = options.ymin || 0.0;
  const ymax = options.ymax || 1.0;

  return (points) => {
    let blankedPrevious = false;
    return points.reduce<Point[]>((acc, p) => {
      let { x, y } = p;
      const { r, g, b } = p;
      const outOfBounds = (x<xmin || x>xmax || y<ymin || y>ymax);
      // skip if already blanked previous and still out of bounds
      if (outOfBounds && blankedPrevious)
        return acc;
      // put points back in bounds
      x = Math.max(Math.min(x, xmax), xmin);
      y = Math.max(Math.min(y, ymax), ymin);
      // add wait before laser goes off
      if (outOfBounds) {
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
