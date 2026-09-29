import {
  IconAttach,
  IconBuilding,
  IconChevron,
  IconClipboard,
  IconCopy,
  IconDots,
  IconDownload,
  IconEye,
  IconFile,
  IconFolder,
  IconGrip,
  IconKeyboard,
  IconLogo,
  IconMoney,
  IconNote,
  IconPin,
  IconRobot,
  IconSettings,
  IconSparkles,
  IconTag,
  IconTarget,
} from '@/ui/components/icon-set';

const ICONS = {
  logo: IconLogo,
  sparkles: IconSparkles,
  keyboard: IconKeyboard,
  robot: IconRobot,
  target: IconTarget,
  gear: IconSettings,
  tag: IconTag,
  building: IconBuilding,
  pin: IconPin,
  money: IconMoney,
  file: IconFile,
  clipboard: IconClipboard,
  note: IconNote,
  folder: IconFolder,
  dots: IconDots,
  eye: IconEye,
  download: IconDownload,
  attach: IconAttach,
  copy: IconCopy,
  chevron: IconChevron,
  grip: IconGrip,
} as const;

export type IconName = keyof typeof ICONS;

/** Resolves an icon by name so data (guide targets, menu items) can carry one. */
export function Icon({ name, size = 15 }: { name: IconName; size?: number }) {
  const Component = ICONS[name];
  return <Component size={size} />;
}
