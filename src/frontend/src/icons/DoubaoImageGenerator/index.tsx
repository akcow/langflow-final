import type React from "react";
import { forwardRef } from "react";
import SvgDoubaoImageGenerator from "./DoubaoImageGenerator";

export const DoubaoImageGeneratorIcon = forwardRef<
  SVGSVGElement,
  React.PropsWithChildren<{}>
>((props, ref) => {
  return <SvgDoubaoImageGenerator ref={ref} {...props} />;
});


DoubaoImageGeneratorIcon.displayName = "DoubaoImageGeneratorIcon";