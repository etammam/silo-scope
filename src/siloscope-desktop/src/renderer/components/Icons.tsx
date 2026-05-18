import {
  Folder,
  Package,
  Settings,
  PanelRightClose,
  PanelLeftClose,
  LayoutTemplate,
  Plus,
  Box,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Play,
  Search,
  X,
  Check,
  Loader2,
  AlertCircle,
  Info,
} from "lucide-react";
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const defaultProps: IconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function WorkspaceIcon(props: IconProps) {
  return <Folder {...defaultProps} {...props} />;
}

export function NugetIcon(props: IconProps) {
  return <Package {...defaultProps} {...props} />;
}

export function SettingsIcon(props: IconProps) {
  return <Settings {...defaultProps} {...props} />;
}

export function ResponseIcon(props: IconProps) {
  return <PanelRightClose {...defaultProps} {...props} />;
}

export function NavigationIcon(props: IconProps) {
  return <PanelLeftClose {...defaultProps} {...props} />;
}

export function LayoutIcon(props: IconProps) {
  return <LayoutTemplate {...defaultProps} {...props} />;
}

export function NewWorkspaceIcon(props: IconProps) {
  return <Plus {...defaultProps} {...props} />;
}

export function PackageIcon(props: IconProps) {
  return <Box {...defaultProps} {...props} />;
}

export function ChevronRightIcon(props: IconProps) {
  return <ChevronRight {...defaultProps} {...props} />;
}

export function ChevronDownIcon(props: IconProps) {
  return <ChevronDown {...defaultProps} {...props} />;
}

export function MoreIcon(props: IconProps) {
  return <MoreHorizontal {...defaultProps} {...props} />;
}

export function PlayIcon(props: IconProps) {
  return <Play {...defaultProps} {...props} />;
}

export function SearchIcon(props: IconProps) {
  return <Search {...defaultProps} {...props} />;
}

export function CloseIcon(props: IconProps) {
  return <X {...defaultProps} {...props} />;
}

export function CheckIcon(props: IconProps) {
  return <Check {...defaultProps} {...props} />;
}

export function LoaderIcon(props: IconProps) {
  return <Loader2 {...defaultProps} {...props} />;
}

export function AlertIcon(props: IconProps) {
  return <AlertCircle {...defaultProps} {...props} />;
}

export function InfoIcon(props: IconProps) {
  return <Info {...defaultProps} {...props} />;
}