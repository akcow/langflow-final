import type React from "react";
import { forwardRef } from "react";
import SvgDoubaoVideoGenerator from "./DoubaoVideoGenerator";

export const DoubaoVideoGeneratorIcon = forwardRef<
  SVGSVGElement,
  React.PropsWithChildren<{}>
>((props, ref) => {
  return <SvgDoubaoVideoGenerator ref={ref} {...props} />;
});


DoubaoVideoGeneratorIcon.displayName = "DoubaoVideoGeneratorIcon";