// SectionHeading wrapper that reads its label/icon from ConfigContext's
// sectionLabels (Settings > Section Labels editor) instead of a hardcoded
// title, falling back to the given defaults if nothing's been customized.
import React from 'react';
import { ConfigContext, ICON_OPTIONS } from '../../lib/appConfig';
import { SectionHeading } from '../ui/Primitives';

export function EditableSectionHeading({ id, defaultTitle, defaultIcon, subtitle }: { id: string; defaultTitle: string; defaultIcon: any; subtitle: string }) {
  const { sectionLabels } = React.useContext(ConfigContext);
  const override = sectionLabels[id];
  const Icon = (override && ICON_OPTIONS[override.icon]) || defaultIcon;
  const title = (override && override.label) || defaultTitle;
  return <SectionHeading icon={Icon} title={title} subtitle={subtitle} />;
}

