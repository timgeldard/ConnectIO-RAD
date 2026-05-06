const asDate = (value: Date | string | number): Date => value instanceof Date ? value : new Date(value)

export const now = (): Date => new Date()

export const fmtTime = (value: Date | string | number): string => {
  const date = asDate(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export const minutesFromNow = (value: Date | string | number): number => {
  const date = asDate(value)
  if (Number.isNaN(date.getTime())) return 0
  return Math.round((date.getTime() - now().getTime()) / 60000)
}
