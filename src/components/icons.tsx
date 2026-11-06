"use client";
import {
  Plus as Add,
  ArrowCounterClockwise,
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  CheckCircle,
  X as Close,
  CopySimple,
  DotsThree,
  FileText as File,
  type Icon,
  type IconProps,
  LinkBreak,
  LinkSimple,
  PencilSimple,
  ArrowRight as Right,
  List as Rows,
  SidebarSimple,
  SlidersHorizontal,
  SpinnerGap,
  Check as Tick,
  ArrowUpRight as UpRight,
} from "@phosphor-icons/react";
import { forwardRef } from "react";

// One quiet, light-weight icon family throughout application controls.
function light(Component: Icon) {
  return forwardRef<SVGSVGElement, IconProps>((props, ref) => (
    <Component ref={ref} weight="light" {...props} />
  ));
}
export const ArrowRight = light(Right);
export const ArrowUpRight = light(UpRight);
export const CalendarDays = light(CalendarBlank);
export const Check = light(Tick);
export const CheckIcon = Check;
export const ChevronDown = light(CaretDown);
export const ChevronDownIcon = ChevronDown;
export const ChevronLeft = light(CaretLeft);
export const ChevronLeftIcon = ChevronLeft;
export const ChevronRight = light(CaretRight);
export const ChevronRightIcon = ChevronRight;
export const ChevronUpIcon = light(CaretUp);
export const Copy = light(CopySimple);
export const FileText = light(File);
export const List = light(Rows);
export const LoaderCircle = light(SpinnerGap);
export const PanelLeftIcon = light(SidebarSimple);
export const PanelRightOpen = PanelLeftIcon;
export const PanelRightClose = PanelLeftIcon;
export const Plus = light(Add);
export const RotateCcw = light(ArrowCounterClockwise);
export const Settings2 = light(SlidersHorizontal);
export const X = light(Close);
export const XIcon = X;
export const More = light(DotsThree);
export const Edit = light(PencilSimple);
export const ArticleLink = light(LinkSimple);
export const RemoveLink = light(LinkBreak);
export const Posted = light(CheckCircle);
