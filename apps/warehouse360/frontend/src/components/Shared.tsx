/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { Icon, KPI, Card } from '@connectio/shared-ui'
import { minutesFromNow } from '~/utils/time'

export { KPI, Card }

/* Shared filter bar + drawer + small cards */
...
/** Breadcrumb navigation row. */
const Crumbs = ({ items }: { items: CrumbItem[] }) => (
  <div className="crumbs">
    {items.map((c: any, i: number) => (
      <React.Fragment key={i}>
        {i > 0 && <Icon name="chevron-right" size={10}/>}
        {c.onClick ? <a onClick={c.onClick} style={{ cursor: 'pointer' }}>{c.label}</a> : <span>{c.label}</span>}
      </React.Fragment>
    ))}
  </div>
);


export { FilterBar, Drawer, formatETA, Crumbs }
