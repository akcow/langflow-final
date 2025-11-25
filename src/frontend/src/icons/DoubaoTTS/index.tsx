import type React from "react";
import { forwardRef } from "react";
import SvgDoubaoTTS from "./DoubaoTTS";

export const DoubaoTTSIcon = forwardRef<
  SVGSVGElement,
  React.PropsWithChildren<{}>
>((props, ref) => {
  return <SvgDoubaoTTS ref={ref} {...props} />;
});


DoubaoTTSIcon.displayName = "DoubaoTTSIcon";