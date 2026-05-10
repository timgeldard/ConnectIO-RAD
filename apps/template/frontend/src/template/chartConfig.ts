export const templateChartConfig = {
  id: 'template-signals',
  type: 'bar',
  title: 'Template Module Signals',
  dataSource: {
    id: 'template-overview',
    kind: 'api',
    endpoint: '/api/module-template/overview',
    queryKey: ['template', 'signals'],
  },
  props: {
    xField: 'name',
    yField: 'value',
  },
  interactions: [],
  layout: {},
}
