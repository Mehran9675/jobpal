import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const iconsDir = join(root, 'src', 'ui', 'components', 'icon-set');
rmSync(iconsDir, { recursive: true, force: true });
mkdirSync(iconsDir, { recursive: true });

const uiSource = readFileSync(join(root, 'src', 'ui', 'components', 'Icons.tsx'), 'utf8');
const overlaySource = readFileSync(join(root, 'src', 'content', 'overlay-icons.tsx'), 'utf8');

/** name -> { body, rootAttrs } */
const icons = new Map();

const uiPattern = /export const (Icon\w+) = \(props: IconProps\) => \(\s*<svg \{\.\.\.base\(props\)\}([^>]*)>\s*([\s\S]*?)\s*<\/svg>\s*\);/g;
for (const match of uiSource.matchAll(uiPattern)) {
  const [, name, attrs, body] = match;
  icons.set(name, { body: body.trim(), rootAttrs: attrs.trim() });
}

const overlayPattern = /(\w+): '(<svg[^>]*>)([\s\S]*?)<\/svg>'/g;
for (const match of overlaySource.matchAll(overlayPattern)) {
  const [, key, openTag, body] = match;
  const name = `Icon${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  if (icons.has(name)) continue;
  const fill = openTag.includes('fill="currentColor"') ? 'fill="currentColor" stroke="none"' : '';
  const strokeWidth = openTag.includes('stroke-width="2.1"') ? ' strokeWidth={2.1}' : '';
  const translate = { 'stroke-width': 'strokeWidth', 'stroke-linecap': 'strokeLinecap', 'stroke-linejoin': 'strokeLinejoin' };
  let bodyJsx = body.trim();
  for (const [from, to] of Object.entries(translate)) bodyJsx = bodyJsx.replaceAll(from, to);
  icons.set(name, { body: bodyJsx, rootAttrs: `${fill}${strokeWidth}`.trim() });
}

writeFileSync(
  join(iconsDir, 'types.ts'),
  `import type { SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

export function iconBase({ size = 16, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  };
}
`,
);

let count = 0;
for (const [name, icon] of icons) {
  const usesFillOverride = icon.rootAttrs.includes('fill=');
  const attrs = usesFillOverride ? `{...iconBase(props)} ${icon.rootAttrs}` : '{...iconBase(props)}';
  const file = `import type { IconProps } from './types';
import { iconBase } from './types';

export function ${name}(props: IconProps) {
  return (
    <svg ${attrs}>
      ${icon.body}
    </svg>
  );
}
`;
  writeFileSync(join(iconsDir, `${name}.tsx`), file);
  count += 1;
}

const barrel = `export type { IconProps } from './types';
export { iconBase } from './types';
${[...icons.keys()].map((name) => `export { ${name} } from './${name}';`).join('\n')}
`;
writeFileSync(join(iconsDir, 'index.ts'), barrel);

// Turn the old collection module into a barrel so existing imports keep working.
writeFileSync(
  join(root, 'src', 'ui', 'components', 'Icons.tsx'),
  `// Barrel: every icon lives in its own file under ./icons.
export * from './icons';
`,
);

console.log(`[icons] generated ${count} icon components`);
void existsSync;
