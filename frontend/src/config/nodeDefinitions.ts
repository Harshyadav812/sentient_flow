import type { LucideIcon } from 'lucide-react';
import {
  Zap, Globe, GitBranch, Printer, Clock, Settings, Merge, Calculator,
  Code2, Repeat, Webhook, FileText, BrainCircuit, Tags, FileSearch,
  Filter, ArrowDownUp, ListEnd, Sigma, Type, CalendarClock, Braces,
  Fingerprint, OctagonX, Split,
} from 'lucide-react';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type PropertyType = 'string' | 'number' | 'boolean' | 'options' | 'json' | 'json-array' | 'code' | 'credential';

export type Category = 'trigger' | 'action' | 'data' | 'logic' | 'output' | 'ai';

export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  trigger: { label: 'Triggers', color: '#ff6d5a' },
  action: { label: 'Actions', color: '#3b82f6' },
  data: { label: 'Data & Transform', color: '#06b6d4' },
  logic: { label: 'Flow & Logic', color: '#a855f7' },
  output: { label: 'Output', color: '#10b981' },
  ai: { label: 'AI', color: '#a78bfa' },
};

export const CATEGORY_ORDER: Category[] = ['trigger', 'action', 'data', 'logic', 'output', 'ai'];

export interface NodeProperty {
  name: string;
  displayName: string;
  type: PropertyType;
  default: unknown;
  required?: boolean;        // Shows red asterisk, blocks execution if empty
  placeholder?: string;      // Hint text inside input
  description?: string;      // Help text below field
  options?: { name: string; value: string | number | boolean }[];
  min?: number;              // For number fields
  max?: number;              // For number fields
  pattern?: string;          // Regex validation for string fields
  patternMessage?: string;   // Custom error message when pattern fails
  showWhen?: { field: string; values: unknown[] };
  multiline?: boolean;
}

export interface NodeDefinition {
  type: string;
  defaultLabel: string;      // Default name when dropped onto canvas
  description: string;       // Shown in palette tooltip + properties header
  category: Category;
  icon: LucideIcon;
  properties: NodeProperty[];
  hidden?: boolean;          // Still runs, but not offered in the palette
  keywords?: string;         // Extra search terms for the palette
}

export function isPropertyVisible(
  nodeType: string,
  prop: NodeProperty,
  params: Record<string, unknown>
): boolean {
  if (!prop.showWhen) return true;
  const { field, values } = prop.showWhen;
  const fallback = NODE_DEFINITIONS[nodeType]?.properties.find((p) => p.name === field)?.default;
  return values.includes(params[field] ?? fallback);
}

/** Labels for each output handle. A single unlabeled output is `['']`. */
export function getOutputLabels(type: string, params: Record<string, unknown>): string[] {
  if (type === 'if' || type === 'condition') return ['true', 'false'];
  if (type === 'switch') {
    const cases = Array.isArray(params.cases) ? params.cases : [];
    return [...cases.map((c) => String(c)), 'default'];
  }
  return [''];
}

// =============================================================================
// VALIDATION HELPER
// =============================================================================

export interface ValidationError {
  field: string;
  message: string;
}

export function validateNodeParams(
  nodeType: string,
  params: Record<string, unknown>
): ValidationError[] {
  const def = NODE_DEFINITIONS[nodeType];
  if (!def) return [];

  const errors: ValidationError[] = [];

  for (const prop of def.properties) {
    if (!isPropertyVisible(nodeType, prop, params)) continue;
    const value = params[prop.name];

    // Required check
    if (prop.required) {
      if (value === undefined || value === null || value === '') {
        errors.push({ field: prop.name, message: `${prop.displayName} is required` });
        continue;
      }
    }

    // Skip further validation if empty and not required
    if (value === undefined || value === null || value === '') continue;

    // Number range checks
    if (prop.type === 'number' && typeof value === 'number') {
      if (prop.min !== undefined && value < prop.min) {
        errors.push({ field: prop.name, message: `${prop.displayName} must be at least ${prop.min}` });
      }
      if (prop.max !== undefined && value > prop.max) {
        errors.push({ field: prop.name, message: `${prop.displayName} must be at most ${prop.max}` });
      }
    }

    // Pattern check
    if (prop.type === 'string' && prop.pattern && typeof value === 'string') {
      const regex = new RegExp(prop.pattern);
      if (!regex.test(value)) {
        errors.push({
          field: prop.name,
          message: prop.patternMessage || `${prop.displayName} has invalid format`,
        });
      }
    }
  }

  return errors;
}

// =============================================================================
// NODE DEFINITIONS REGISTRY
// =============================================================================

const COMPARE_OPTIONS = [
  { name: 'Equals (==)', value: '==' },
  { name: 'Not Equals (!=)', value: '!=' },
  { name: 'Greater Than (>)', value: '>' },
  { name: 'Less Than (<)', value: '<' },
  { name: 'Greater or Equal (>=)', value: '>=' },
  { name: 'Less or Equal (<=)', value: '<=' },
  { name: 'Contains', value: 'contains' },
  { name: 'Starts With', value: 'startswith' },
  { name: 'Ends With', value: 'endswith' },
];

const listProp: NodeProperty = {
  name: 'list',
  displayName: 'List',
  type: 'string',
  default: '',
  placeholder: "$'HTTP Request' or leave empty",
  description: "A $ reference to a list. Leave empty to use the previous node's output.",
};

const fieldProp = (description: string, placeholder = 'status'): NodeProperty => ({
  name: 'field',
  displayName: 'Field',
  type: 'string',
  default: '',
  placeholder,
  description,
});

const DATE_FORMAT_HINT = 'Optional strftime pattern, e.g. %Y-%m-%d or %d %b %Y %H:%M. Empty = ISO 8601.';

export const NODE_DEFINITIONS: Record<string, NodeDefinition> = {

  // ─── TRIGGERS ──────────────────────────────────────────────────────────────

  manual_trigger: {
    type: 'manual_trigger',
    defaultLabel: 'Start',
    description: 'Manually starts the workflow. Every workflow needs at least one trigger.',
    category: 'trigger',
    icon: Zap,
    properties: [],
  },

  webhook: {
    type: 'webhook',
    defaultLabel: 'Webhook',
    description: 'Starts workflow when an HTTP request is received at the configured path.',
    category: 'trigger',
    icon: Webhook,
    properties: [
      {
        name: 'path',
        displayName: 'Path',
        type: 'string',
        default: '/my-webhook',
        required: true,
        placeholder: '/my-webhook',
        description: 'URL path that triggers this workflow (e.g. /my-webhook)',
        pattern: '^\\/.*',
        patternMessage: 'Path must start with /',
      },
      {
        name: 'method',
        displayName: 'HTTP Method',
        type: 'options',
        default: 'POST',
        options: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
        ],
      },
      {
        name: 'responseCode',
        displayName: 'Response Code',
        type: 'number',
        default: 200,
        min: 100,
        max: 599,
        description: 'HTTP status code to return after triggering',
      },
    ],
  },

  // ─── ACTIONS ───────────────────────────────────────────────────────────────

  http: {
    type: 'http',
    defaultLabel: 'HTTP Request',
    description: 'Make an HTTP request to any API endpoint.',
    category: 'action',
    icon: Globe,
    properties: [
      {
        name: 'url',
        displayName: 'URL',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'https://api.example.com/data',
        description: 'The URL to send the request to. Use $NodeName.field for dynamic values.',
        pattern: '^(https?:\\/\\/|\\$).*',
        patternMessage: 'Must be a valid URL (http:// or https://) or a $ variable reference',
      },
      {
        name: 'method',
        displayName: 'Method',
        type: 'options',
        default: 'GET',
        options: [
          { name: 'GET', value: 'GET' },
          { name: 'POST', value: 'POST' },
          { name: 'PUT', value: 'PUT' },
          { name: 'PATCH', value: 'PATCH' },
          { name: 'DELETE', value: 'DELETE' },
        ],
      },
      {
        name: 'body',
        displayName: 'Body',
        type: 'json',
        default: {},
        placeholder: '{ "key": "value" }',
        description: 'Request body (JSON). Only used for POST/PUT/PATCH.',
      },
      {
        name: 'headers',
        displayName: 'Headers',
        type: 'json',
        default: {},
        placeholder: '{ "Authorization": "Bearer ..." }',
        description: 'Custom HTTP headers to include in the request.',
      },
      {
        name: 'timeout',
        displayName: 'Timeout (seconds)',
        type: 'number',
        default: 60,
        min: 1,
        max: 300,
        description: 'Maximum wait time before the request times out.',
      },
      {
        name: 'retries',
        displayName: 'Retries',
        type: 'number',
        default: 0,
        min: 0,
        max: 10,
        description: 'Number of times to retry on failure.',
      },
      {
        name: 'retry_delay',
        displayName: 'Retry Delay (seconds)',
        type: 'number',
        default: 1,
        min: 0,
        max: 60,
      },
    ],
  },

  calculate: {
    type: 'calculate',
    defaultLabel: 'Calculate',
    description: 'Perform math operations on numbers.',
    category: 'action',
    icon: Calculator,
    properties: [
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'options',
        default: 'add',
        required: true,
        options: [
          { name: 'Add (+)', value: 'add' },
          { name: 'Subtract (−)', value: 'sub' },
          { name: 'Multiply (×)', value: 'mul' },
          { name: 'Divide (÷)', value: 'divide' },
        ],
      },
      {
        name: 'numbers',
        displayName: 'Numbers',
        type: 'json-array',
        default: [1, 1],
        required: true,
        description: 'Array of numbers. Example: [10, 5, 2]. Use $ references for dynamic values.',
        placeholder: '[10, 5, 2]',
      },
    ],
  },

  delay: {
    type: 'delay',
    defaultLabel: 'Wait',
    description: 'Pause workflow execution for a specified duration.',
    category: 'action',
    icon: Clock,
    properties: [
      {
        name: 'seconds',
        displayName: 'Seconds',
        type: 'number',
        default: 1,
        required: true,
        min: 0,
        max: 3600,
        description: 'How many seconds to wait before continuing.',
      },
    ],
  },

  code: {
    type: 'code',
    defaultLabel: 'Code',
    description: 'Execute a Python expression. Has access to input data via the "input" variable.',
    category: 'action',
    icon: Code2,
    properties: [
      {
        name: 'expression',
        displayName: 'Expression',
        type: 'code',
        default: '',
        required: true,
        placeholder: 'len(input) if isinstance(input, list) else input',
        description: 'Python expression to evaluate. The variable "input" contains data from the previous node. Only expressions are allowed (no import, exec, etc).',
      },
      {
        name: 'fallback',
        displayName: 'Fallback Value',
        type: 'string',
        default: '',
        placeholder: 'null',
        description: 'Value to return if the expression throws an error. Leave empty to propagate errors.',
      },
    ],
  },

  // ─── LOGIC ─────────────────────────────────────────────────────────────────

  if: {
    type: 'if',
    defaultLabel: 'IF',
    description: 'Send data down the true or false branch based on a comparison.',
    keywords: 'condition branch compare',
    category: 'logic',
    icon: GitBranch,
    properties: [
      {
        name: 'left',
        displayName: 'Value 1 (Left)',
        type: 'string',
        default: '',
        required: true,
        placeholder: "$'Set Data'.count",
        description: 'First comparison value. Use $ syntax to reference other node outputs.',
      },
      {
        name: 'operator',
        displayName: 'Operator',
        type: 'options',
        default: '==',
        required: true,
        options: [
          { name: 'Equals (==)', value: '==' },
          { name: 'Not Equals (!=)', value: '!=' },
          { name: 'Greater Than (>)', value: '>' },
          { name: 'Less Than (<)', value: '<' },
          { name: 'Greater or Equal (>=)', value: '>=' },
          { name: 'Less or Equal (<=)', value: '<=' },
          { name: 'Contains', value: 'contains' },
          { name: 'Starts With', value: 'startswith' },
          { name: 'Ends With', value: 'endswith' },
        ],
      },
      {
        name: 'right',
        displayName: 'Value 2 (Right)',
        type: 'string',
        default: '',
        required: true,
        placeholder: '10',
        description: 'Second comparison value.',
      },
    ],
  },

  condition: {
    type: 'condition',
    defaultLabel: 'Condition',
    description: 'Alias for IF node. Branches TRUE (output 0) / FALSE (output 1).',
    category: 'logic',
    hidden: true,
    icon: GitBranch,
    properties: [
      {
        name: 'left',
        displayName: 'Value 1 (Left)',
        type: 'string',
        default: '',
        required: true,
        placeholder: "$'Set Data'.count",
      },
      {
        name: 'operator',
        displayName: 'Operator',
        type: 'options',
        default: '==',
        required: true,
        options: [
          { name: 'Equals (==)', value: '==' },
          { name: 'Not Equals (!=)', value: '!=' },
          { name: 'Greater Than (>)', value: '>' },
          { name: 'Less Than (<)', value: '<' },
          { name: 'Greater or Equal (>=)', value: '>=' },
          { name: 'Less or Equal (<=)', value: '<=' },
          { name: 'Contains', value: 'contains' },
          { name: 'Starts With', value: 'startswith' },
          { name: 'Ends With', value: 'endswith' },
        ],
      },
      {
        name: 'right',
        displayName: 'Value 2 (Right)',
        type: 'string',
        default: '',
        required: true,
        placeholder: '10',
      },
    ],
  },

  switch: {
    type: 'switch',
    defaultLabel: 'Switch',
    description: 'Send data to a different output for each matching case. Anything else goes to "default".',
    category: 'logic',
    icon: Split,
    keywords: 'route case router',
    properties: [
      {
        name: 'value',
        displayName: 'Value to Match',
        type: 'string',
        default: '',
        required: true,
        placeholder: "$'Set Data'.status",
        description: 'The value to compare against each case.',
      },
      {
        name: 'cases',
        displayName: 'Cases',
        type: 'json-array',
        default: [],
        required: true,
        placeholder: '["active", "paused", "stopped"]',
        description: 'Each case gets its own output on the node, plus a "default" output for no match.',
      },
    ],
  },

  merge: {
    type: 'merge',
    defaultLabel: 'Merge',
    description: 'Combine data from multiple incoming branches into one.',
    category: 'logic',
    icon: Merge,
    properties: [
      {
        name: 'mode',
        displayName: 'Mode',
        type: 'options',
        default: 'append',
        options: [
          { name: 'Append (combine all inputs)', value: 'append' },
        ],
        description: 'How to combine the incoming data.',
      },
    ],
  },

  loop: {
    type: 'loop',
    defaultLabel: 'Loop',
    description: 'Wraps the previous output in { items, count }. Superseded by Filter, Sort and Limit.',
    category: 'logic',
    hidden: true,
    icon: Repeat,
    properties: [
      {
        name: 'listExpression',
        displayName: 'List Source',
        type: 'string',
        default: '',
        required: true,
        placeholder: "$'HTTP Request'.data",
        description: 'Expression that resolves to a list. Each item will be passed as input to the next node.',
      },
      {
        name: 'maxIterations',
        displayName: 'Max Iterations',
        type: 'number',
        default: 100,
        min: 1,
        max: 10000,
        description: 'Safety limit to prevent infinite loops.',
      },
    ],
  },

  stop_error: {
    type: 'stop_error',
    defaultLabel: 'Stop & Error',
    description: 'Stop the workflow and mark the run as failed with your own message.',
    category: 'logic',
    icon: OctagonX,
    keywords: 'fail throw abort halt',
    properties: [
      {
        name: 'message',
        displayName: 'Error Message',
        type: 'string',
        default: '',
        required: true,
        placeholder: 'No orders found for today',
      },
    ],
  },

  // ─── DATA & TRANSFORM ──────────────────────────────────────────────────────

  filter: {
    type: 'filter',
    defaultLabel: 'Filter',
    description: 'Keep only the list items that match a condition.',
    category: 'data',
    icon: Filter,
    keywords: 'where keep remove list items',
    properties: [
      listProp,
      fieldProp('Field to check on each item. Use dots for nested fields (address.city). Empty = the item itself.'),
      {
        name: 'operator',
        displayName: 'Condition',
        type: 'options',
        default: '==',
        options: [
          ...COMPARE_OPTIONS,
          { name: 'Is Empty', value: 'is_empty' },
          { name: 'Is Not Empty', value: 'is_not_empty' },
        ],
      },
      {
        name: 'value',
        displayName: 'Value',
        type: 'string',
        default: '',
        placeholder: 'open',
        showWhen: { field: 'operator', values: COMPARE_OPTIONS.map((o) => o.value) },
      },
    ],
  },

  sort: {
    type: 'sort',
    defaultLabel: 'Sort',
    description: 'Sort list items by a field, ascending or descending.',
    category: 'data',
    icon: ArrowDownUp,
    keywords: 'order list items',
    properties: [
      listProp,
      fieldProp('Field to sort by. Items missing it go last. Empty = sort the items themselves.', 'priority'),
      {
        name: 'order',
        displayName: 'Order',
        type: 'options',
        default: 'asc',
        options: [
          { name: 'Ascending (A → Z, 1 → 9)', value: 'asc' },
          { name: 'Descending (Z → A, 9 → 1)', value: 'desc' },
        ],
      },
    ],
  },

  limit: {
    type: 'limit',
    defaultLabel: 'Limit',
    description: 'Keep only the first or last N items of a list.',
    category: 'data',
    icon: ListEnd,
    keywords: 'top first last take slice',
    properties: [
      listProp,
      { name: 'count', displayName: 'Max Items', type: 'number', default: 10, min: 0, max: 10000, required: true },
      {
        name: 'keep',
        displayName: 'Keep',
        type: 'options',
        default: 'first',
        options: [
          { name: 'First items', value: 'first' },
          { name: 'Last items', value: 'last' },
        ],
      },
    ],
  },

  aggregate: {
    type: 'aggregate',
    defaultLabel: 'Aggregate',
    description: 'Reduce a list to one value: count, sum, average, min, max, join or unique.',
    category: 'data',
    icon: Sigma,
    keywords: 'sum total count average min max join reduce',
    properties: [
      listProp,
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'options',
        default: 'count',
        options: [
          { name: 'Count', value: 'count' },
          { name: 'Sum', value: 'sum' },
          { name: 'Average', value: 'average' },
          { name: 'Minimum', value: 'min' },
          { name: 'Maximum', value: 'max' },
          { name: 'Join into text', value: 'join' },
          { name: 'Unique values', value: 'unique' },
        ],
      },
      fieldProp('Field to read from each item. Empty = use the items themselves.', 'price'),
      {
        name: 'separator',
        displayName: 'Separator',
        type: 'string',
        default: ', ',
        showWhen: { field: 'operation', values: ['join'] },
      },
    ],
  },

  text_ops: {
    type: 'text_ops',
    defaultLabel: 'Text',
    description: 'Change case, trim, replace, split, truncate or count text.',
    category: 'data',
    icon: Type,
    keywords: 'string uppercase lowercase replace split trim length words',
    properties: [
      {
        name: 'text',
        displayName: 'Text',
        type: 'string',
        default: '',
        placeholder: "$'AI Chat'.text or leave empty",
        description: "Leave empty to use the previous node's output.",
      },
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'options',
        default: 'uppercase',
        options: [
          { name: 'UPPERCASE', value: 'uppercase' },
          { name: 'lowercase', value: 'lowercase' },
          { name: 'Title Case', value: 'title' },
          { name: 'Trim whitespace', value: 'trim' },
          { name: 'Replace', value: 'replace' },
          { name: 'Split into list', value: 'split' },
          { name: 'Truncate', value: 'truncate' },
          { name: 'Length (characters)', value: 'length' },
          { name: 'Word count', value: 'word_count' },
        ],
      },
      { name: 'find', displayName: 'Find', type: 'string', default: '', required: true, showWhen: { field: 'operation', values: ['replace'] } },
      { name: 'replace_with', displayName: 'Replace With', type: 'string', default: '', showWhen: { field: 'operation', values: ['replace'] } },
      { name: 'separator', displayName: 'Separator', type: 'string', default: ',', showWhen: { field: 'operation', values: ['split'] } },
      { name: 'max_length', displayName: 'Max Length', type: 'number', default: 100, min: 0, showWhen: { field: 'operation', values: ['truncate'] } },
    ],
  },

  datetime: {
    type: 'datetime',
    defaultLabel: 'Date & Time',
    description: 'Get the current time, format dates, add or subtract time, or measure the gap between two dates.',
    category: 'data',
    icon: CalendarClock,
    keywords: 'date time now today timestamp format duration',
    properties: [
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'options',
        default: 'now',
        options: [
          { name: 'Current date & time', value: 'now' },
          { name: 'Format a date', value: 'format' },
          { name: 'Add time', value: 'add' },
          { name: 'Subtract time', value: 'subtract' },
          { name: 'Difference between dates', value: 'difference' },
        ],
      },
      {
        name: 'date',
        displayName: 'Date',
        type: 'string',
        default: '',
        placeholder: '2026-01-31T09:00:00Z',
        description: 'ISO 8601 date or Unix timestamp. Empty = now (UTC).',
        showWhen: { field: 'operation', values: ['format', 'add', 'subtract', 'difference'] },
      },
      {
        name: 'end_date',
        displayName: 'End Date',
        type: 'string',
        default: '',
        placeholder: '2026-02-14T09:00:00Z',
        description: 'Empty = now (UTC).',
        showWhen: { field: 'operation', values: ['difference'] },
      },
      {
        name: 'amount',
        displayName: 'Amount',
        type: 'number',
        default: 1,
        showWhen: { field: 'operation', values: ['add', 'subtract'] },
      },
      {
        name: 'unit',
        displayName: 'Unit',
        type: 'options',
        default: 'days',
        options: ['seconds', 'minutes', 'hours', 'days', 'weeks'].map((u) => ({ name: u[0].toUpperCase() + u.slice(1), value: u })),
        showWhen: { field: 'operation', values: ['add', 'subtract', 'difference'] },
      },
      {
        name: 'format',
        displayName: 'Output Format',
        type: 'string',
        default: '',
        placeholder: '%d %b %Y',
        description: DATE_FORMAT_HINT,
        showWhen: { field: 'operation', values: ['now', 'format', 'add', 'subtract'] },
      },
    ],
  },

  json: {
    type: 'json',
    defaultLabel: 'JSON',
    description: 'Parse a JSON string into data, or turn data into a JSON string.',
    category: 'data',
    icon: Braces,
    keywords: 'parse stringify serialize',
    properties: [
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'options',
        default: 'parse',
        options: [
          { name: 'Parse (text → data)', value: 'parse' },
          { name: 'Stringify (data → text)', value: 'stringify' },
        ],
      },
      {
        name: 'value',
        displayName: 'Value',
        type: 'string',
        default: '',
        placeholder: "$'HTTP Request'.text or leave empty",
        description: "Leave empty to use the previous node's output.",
      },
      { name: 'pretty', displayName: 'Pretty Print', type: 'boolean', default: false, showWhen: { field: 'operation', values: ['stringify'] } },
    ],
  },

  crypto: {
    type: 'crypto',
    defaultLabel: 'Crypto',
    description: 'Generate a UUID or random number, hash text, or encode and decode Base64.',
    category: 'data',
    icon: Fingerprint,
    keywords: 'uuid random hash sha256 md5 base64 encode decode id',
    properties: [
      {
        name: 'operation',
        displayName: 'Operation',
        type: 'options',
        default: 'uuid',
        options: [
          { name: 'Generate UUID', value: 'uuid' },
          { name: 'Random number', value: 'random_number' },
          { name: 'SHA-256 hash', value: 'sha256' },
          { name: 'SHA-1 hash', value: 'sha1' },
          { name: 'MD5 hash', value: 'md5' },
          { name: 'Base64 encode', value: 'base64_encode' },
          { name: 'Base64 decode', value: 'base64_decode' },
        ],
      },
      {
        name: 'value',
        displayName: 'Value',
        type: 'string',
        default: '',
        description: "Leave empty to use the previous node's output.",
        showWhen: { field: 'operation', values: ['sha256', 'sha1', 'md5', 'base64_encode', 'base64_decode'] },
      },
      { name: 'min', displayName: 'Min', type: 'number', default: 1, showWhen: { field: 'operation', values: ['random_number'] } },
      { name: 'max', displayName: 'Max', type: 'number', default: 100, showWhen: { field: 'operation', values: ['random_number'] } },
    ],
  },

  // ─── OUTPUT ────────────────────────────────────────────────────────────────

  set: {
    type: 'set',
    defaultLabel: 'Set Data',
    description: 'Store a value that can be referenced by downstream nodes using $ syntax.',
    category: 'output',
    icon: Settings,
    properties: [
      {
        name: 'value',
        displayName: 'Value',
        type: 'json',
        default: {},
        placeholder: '{ "name": "John", "count": 42 }',
        description: 'The data object to store. Access fields downstream with $\'Set Data\'.name',
      },
    ],
  },

  print: {
    type: 'print',
    defaultLabel: 'Print',
    description: 'Output data to the console. If no content is specified, prints the input from the previous node.',
    category: 'output',
    icon: Printer,
    properties: [
      {
        name: 'content',
        displayName: 'Content',
        type: 'string',
        default: '',
        placeholder: 'Leave empty to print input data',
        description: 'Static text or $ reference to print. Leave empty to pass through input.',
      },
    ],
  },

  text_template: {
    type: 'text_template',
    defaultLabel: 'Text Template',
    description: 'Build a string by interpolating values from other nodes using $ syntax.',
    category: 'output',
    icon: FileText,
    properties: [
      {
        name: 'template',
        displayName: 'Template',
        type: 'string',
        multiline: true,
        default: '',
        required: true,
        placeholder: "Hello $'Set Data'.name, your score is $'Calculate'.result",
        description: 'Text with $ variables. Each $reference is replaced with the actual value at runtime.',
      },
    ],
  },

  // ─── AI / LLM ──────────────────────────────────────────────────────────────

  llm_chat: {
    type: 'llm_chat',
    defaultLabel: 'AI Chat',
    description: 'Send a prompt to any LLM (OpenAI, Anthropic, Google, NVIDIA, Ollama) and get a response.',
    category: 'ai',
    icon: BrainCircuit,
    properties: [
      {
        name: 'provider',
        displayName: 'Provider',
        type: 'options',
        default: 'openai',
        required: true,
        options: [
          { name: 'OpenAI', value: 'openai' },
          { name: 'Anthropic', value: 'anthropic' },
          { name: 'Google Gemini', value: 'google' },
          { name: 'NVIDIA NIM', value: 'nvidia' },
          { name: 'Ollama (local)', value: 'ollama' },
          { name: 'Custom OpenAI-compatible', value: 'custom' },
        ],
        description: 'LLM provider to use.',
      },
      {
        name: 'credential',
        displayName: 'Credential',
        type: 'credential',
        default: '',
        placeholder: 'Select a saved credential',
        description: 'Select a saved credential containing your API key (Dashboard → Credentials).',
      },
      {
        name: 'model',
        displayName: 'Model',
        type: 'string',
        default: '',
        placeholder: 'gpt-4o-mini',
        description: 'Model name (leave empty for provider default: gpt-4o-mini, claude-sonnet-4-20250514, gemini-2.0-flash, etc).',
      },
      {
        name: 'system_prompt',
        displayName: 'System Prompt',
        type: 'string',
        multiline: true,
        default: '',
        placeholder: 'You are a helpful assistant...',
        description: 'Optional system prompt to set the LLM\'s behavior.',
      },
      {
        name: 'prompt',
        displayName: 'User Prompt',
        type: 'string',
        multiline: true,
        default: '',
        required: true,
        placeholder: "Explain $'Set Data'.topic in simple terms",
        description: 'The prompt to send. Use $ syntax for dynamic values. If empty, uses input from the previous node.',
      },
      {
        name: 'temperature',
        displayName: 'Temperature',
        type: 'number',
        default: 0.7,
        min: 0,
        max: 2,
        description: '0 = deterministic, 1 = creative, 2 = max randomness.',
      },
      {
        name: 'max_tokens',
        displayName: 'Max Tokens',
        type: 'number',
        default: 1024,
        min: 1,
        max: 128000,
        description: 'Maximum number of tokens in the response.',
      },
      {
        name: 'base_url',
        displayName: 'Custom Base URL',
        type: 'string',
        default: '',
        placeholder: 'https://my-api.example.com/v1/chat/completions',
        description: 'Override the API endpoint URL (for custom/self-hosted providers).',
      },
    ],
  },

  llm_classify: {
    type: 'llm_classify',
    defaultLabel: 'AI Classify',
    description: 'Classify text into categories using an LLM. Perfect for sentiment analysis, content moderation, intent detection.',
    category: 'ai',
    icon: Tags,
    properties: [
      {
        name: 'provider',
        displayName: 'Provider',
        type: 'options',
        default: 'openai',
        required: true,
        options: [
          { name: 'OpenAI', value: 'openai' },
          { name: 'Anthropic', value: 'anthropic' },
          { name: 'Google Gemini', value: 'google' },
          { name: 'NVIDIA NIM', value: 'nvidia' },
          { name: 'Ollama (local)', value: 'ollama' },
          { name: 'Custom OpenAI-compatible', value: 'custom' },
        ],
      },
      {
        name: 'credential',
        displayName: 'Credential',
        type: 'credential',
        default: '',
        placeholder: 'Select a saved credential',
        description: 'Select a saved credential containing your API key (Dashboard → Credentials).',
      },
      {
        name: 'model',
        displayName: 'Model',
        type: 'string',
        default: '',
        placeholder: 'gpt-4o-mini',
        description: 'Model name (leave empty for provider default).',
      },
      {
        name: 'text',
        displayName: 'Text to Classify',
        type: 'string',
        multiline: true,
        default: '',
        placeholder: "$'HTTP Request'.body or paste text here",
        description: 'The text to classify. If empty, uses input from previous node.',
      },
      {
        name: 'categories',
        displayName: 'Categories',
        type: 'json-array',
        default: ['positive', 'negative', 'neutral'],
        required: true,
        placeholder: '["spam", "ham"]',
        description: 'Array of category labels. The LLM picks exactly one.',
      },
      {
        name: 'base_url',
        displayName: 'Custom Base URL',
        type: 'string',
        default: '',
        placeholder: 'https://my-api.example.com/v1/chat/completions',
      },
    ],
  },

  llm_summarize: {
    type: 'llm_summarize',
    defaultLabel: 'AI Summarize',
    description: 'Summarize long text using an LLM. Choose style and length.',
    category: 'ai',
    icon: FileSearch,
    properties: [
      {
        name: 'provider',
        displayName: 'Provider',
        type: 'options',
        default: 'openai',
        required: true,
        options: [
          { name: 'OpenAI', value: 'openai' },
          { name: 'Anthropic', value: 'anthropic' },
          { name: 'Google Gemini', value: 'google' },
          { name: 'NVIDIA NIM', value: 'nvidia' },
          { name: 'Ollama (local)', value: 'ollama' },
          { name: 'Custom OpenAI-compatible', value: 'custom' },
        ],
      },
      {
        name: 'credential',
        displayName: 'Credential',
        type: 'credential',
        default: '',
        placeholder: 'Select a saved credential',
        description: 'Select a saved credential containing your API key (Dashboard → Credentials).',
      },
      {
        name: 'model',
        displayName: 'Model',
        type: 'string',
        default: '',
        placeholder: 'gpt-4o-mini',
        description: 'Model name (leave empty for provider default).',
      },
      {
        name: 'text',
        displayName: 'Text to Summarize',
        type: 'string',
        multiline: true,
        default: '',
        placeholder: "$'HTTP Request'.body or paste text here",
        description: 'The text to summarize. If empty, uses input from previous node.',
      },
      {
        name: 'style',
        displayName: 'Style',
        type: 'options',
        default: 'concise',
        options: [
          { name: 'Concise', value: 'concise' },
          { name: 'Detailed', value: 'detailed' },
          { name: 'Bullet Points', value: 'bullet points' },
          { name: 'ELI5 (Simple)', value: 'simple, explain-like-im-5' },
          { name: 'Technical', value: 'technical' },
        ],
        description: 'Summary style.',
      },
      {
        name: 'max_length',
        displayName: 'Max Length',
        type: 'options',
        default: '2-3 sentences',
        options: [
          { name: '1 sentence', value: '1 sentence' },
          { name: '2-3 sentences', value: '2-3 sentences' },
          { name: '1 paragraph', value: '1 paragraph' },
          { name: '3-5 bullet points', value: '3-5 bullet points' },
        ],
        description: 'Approximate length of the summary.',
      },
      {
        name: 'base_url',
        displayName: 'Custom Base URL',
        type: 'string',
        default: '',
        placeholder: 'https://my-api.example.com/v1/chat/completions',
      },
    ],
  },
};

// =============================================================================
// HELPERS
// =============================================================================

/** Get default parameters for a node type (used when dropping from palette) */
export function getDefaultParams(nodeType: string): Record<string, unknown> {
  const def = NODE_DEFINITIONS[nodeType];
  if (!def) return {};

  const params: Record<string, unknown> = {};
  for (const prop of def.properties) {
    if (prop.default !== undefined && prop.default !== '') {
      params[prop.name] = prop.default;
    }
  }
  return params;
}

export function getPaletteNodes(): NodeDefinition[] {
  return Object.values(NODE_DEFINITIONS).filter((def) => !def.hidden);
}

export function getCategory(nodeType: string): Category {
  return NODE_DEFINITIONS[nodeType]?.category ?? (nodeType.includes('trigger') ? 'trigger' : 'action');
}

const short = (v: unknown, max = 22) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v ?? '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

const optionName = (type: string, field: string, value: unknown) =>
  NODE_DEFINITIONS[type]?.properties
    .find((p) => p.name === field)
    ?.options?.find((o) => o.value === value)?.name ?? String(value ?? '');

/** One-line description of what a configured node will do, shown under its name. */
export function getNodeSummary(type: string, p: Record<string, unknown>): string {
  const op = (field = 'operation') => optionName(type, field, p[field] ?? NODE_DEFINITIONS[type]?.properties.find((x) => x.name === field)?.default);
  switch (type) {
    case 'http': {
      const url = String(p.url ?? '');
      let host = url;
      try { host = new URL(url).host; } catch { /* keep raw */ }
      return url ? `${p.method ?? 'GET'} ${short(host, 18)}` : 'No URL set';
    }
    case 'webhook': return `${p.method ?? 'POST'} ${short(p.path ?? '')}`;
    case 'if':
    case 'condition':
      return p.left ? short(`${short(p.left, 10)} ${p.operator ?? '=='} ${short(p.right, 8)}`, 26) : 'Set a condition';
    case 'switch': return `${Array.isArray(p.cases) ? p.cases.length : 0} cases`;
    case 'delay': return `${p.seconds ?? 1}s`;
    case 'calculate': return op();
    case 'set': return p.value && typeof p.value === 'object' ? short(Object.keys(p.value).join(', ') || 'empty') : 'empty';
    case 'filter': return p.field ? short(`${p.field} ${p.operator ?? '=='} ${p.value ?? ''}`) : 'Set a condition';
    case 'sort': return p.field ? `by ${short(p.field, 14)} ${p.order === 'desc' ? '↓' : '↑'}` : 'by value';
    case 'limit': return `${p.keep === 'last' ? 'last' : 'first'} ${p.count ?? 10}`;
    case 'aggregate': return p.field ? `${op()} of ${short(p.field, 12)}` : op();
    case 'text_ops':
    case 'datetime':
    case 'json':
    case 'crypto':
      return op();
    case 'stop_error': return short(p.message || 'Stops the run');
    case 'text_template': return short(p.template || 'Empty template');
    case 'print': return p.content ? short(p.content) : 'Prints input';
    case 'code': return short(p.expression || 'No expression');
    case 'llm_chat':
    case 'llm_classify':
    case 'llm_summarize':
      return short(p.model || optionName(type, 'provider', p.provider ?? 'openai'));
    default:
      return '';
  }
}
