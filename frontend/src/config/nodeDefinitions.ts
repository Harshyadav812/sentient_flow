export type PropertyType = 'string' | 'number' | 'boolean' | 'options' | 'json' | 'json-array';

export interface NodeProperty {
  name: string;
  displayName: string;
  type: PropertyType;
  default: unknown;
  options?: { name: string; value: string | number | boolean }[];
  description?: string;
}

export interface NodeDefinition {
  type: string;
  properties: NodeProperty[];
}

export const NODE_DEFINITIONS: Record<string, NodeDefinition> = {
  http: {
    type: 'http',
    properties: [
      { name: 'url', displayName: 'URL', type: 'string', default: 'https://api.example.com' },
      { name: 'method', displayName: 'Method', type: 'options', default: 'GET', options: [
        { name: 'GET', value: 'GET' }, { name: 'POST', value: 'POST' }, { name: 'PUT', value: 'PUT' },
        { name: 'PATCH', value: 'PATCH' }, { name: 'DELETE', value: 'DELETE' }
      ]},
      { name: 'body', displayName: 'Body (JSON)', type: 'json', default: {} },
      { name: 'headers', displayName: 'Headers (JSON)', type: 'json', default: {} },
      { name: 'retries', displayName: 'Retries', type: 'number', default: 0 },
      { name: 'retry_delay', displayName: 'Retry Delay', type: 'number', default: 1 },
      { name: 'timeout', displayName: 'Timeout (s)', type: 'number', default: 60 },
    ]
  },
  calculate: {
    type: 'calculate',
    properties: [
      { name: 'operation', displayName: 'Operation', type: 'options', default: 'add', options: [
        { name: 'Add', value: 'add' }, { name: 'Subtract', value: 'subtract' },
        { name: 'Multiply', value: 'multiply' }, { name: 'Divide', value: 'divide' }
      ]},
      { name: 'numbers', displayName: 'Numbers (JSON Array)', type: 'json-array', default: [1, 1], description: 'Provide an array of numbers to perform the calculation on.' },
    ]
  },
  condition: {
    type: 'condition',
    properties: [
      { name: 'left', displayName: 'Value 1', type: 'string', default: '' },
      { name: 'operator', displayName: 'Operator', type: 'options', default: '==', options: [
        { name: '==', value: '==' }, { name: '!=', value: '!=' }, { name: '>', value: '>' },
        { name: '<', value: '<' }, { name: '>=', value: '>=' }, { name: '<=', value: '<=' },
        { name: 'contains', value: 'contains' }, { name: 'startswith', value: 'startswith' }, { name: 'endswith', value: 'endswith' }
      ]},
      { name: 'right', displayName: 'Value 2', type: 'string', default: '' },
    ]
  },
  if: {
    type: 'if',
    properties: [
      { name: 'left', displayName: 'Value 1', type: 'string', default: '' },
      { name: 'operator', displayName: 'Operator', type: 'options', default: '==', options: [
        { name: '==', value: '==' }, { name: '!=', value: '!=' }, { name: '>', value: '>' },
        { name: '<', value: '<' }, { name: '>=', value: '>=' }, { name: '<=', value: '<=' },
        { name: 'contains', value: 'contains' }, { name: 'startswith', value: 'startswith' }, { name: 'endswith', value: 'endswith' }
      ]},
      { name: 'right', displayName: 'Value 2', type: 'string', default: '' },
    ]
  },
  delay: {
    type: 'delay',
    properties: [
      { name: 'seconds', displayName: 'Seconds to Wait', type: 'number', default: 1 },
    ]
  },
  print: {
    type: 'print',
    properties: [
      { name: 'content', displayName: 'Content', type: 'string', default: '' },
    ]
  },
  switch: {
    type: 'switch',
    properties: [
      { name: 'value', displayName: 'Value to Evaluate', type: 'string', default: '' },
      { name: 'cases', displayName: 'Cases (JSON Array)', type: 'json-array', default: [] },
    ]
  },
  merge: {
    type: 'merge',
    properties: [
      { name: 'mode', displayName: 'Mode', type: 'options', default: 'append', options: [
        { name: 'Append', value: 'append' }
      ]},
    ]
  },
  set: {
    type: 'set',
    properties: [
        // Usually arbitrary, but we can set 'value' as an explicitly mapped one if used. We'll leave it mostly empty so it falls back to Custom Params.
    ]
  },
  manual_trigger: {
    type: 'manual_trigger',
    properties: []
  }
};
