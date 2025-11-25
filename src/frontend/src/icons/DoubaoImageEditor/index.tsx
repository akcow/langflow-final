import type React from "react";
import { forwardRef } from "react";
import SvgDoubaoImageEditor from "./DoubaoImageEditor";

export const DoubaoImageEditorIcon = forwardRef<
  SVGSVGElement,
  React.PropsWithChildren<{}>
>((props, ref) => {
  return <SvgDoubaoImageEditor ref={ref} {...props} />;
});


DoubaoImageEditorIcon.displayName = "DoubaoImageEditorIcon";